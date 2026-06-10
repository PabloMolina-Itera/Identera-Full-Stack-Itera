from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uuid
import os
import base64
from mangum import Mangum

# Importamos las reglas dictadas por tu archivo Models (Pydantic)
from models import UsuarioBase, LoginRequest, UpdateStatusRequest, UpdateRoleRequest, UpdateUserProfileRequest, ValidacionBase

# Importamos el motor dictado por tu archivo Database
from database import (
    crear_usuario, obtener_usuario, listar_usuarios, eliminar_usuario, actualizar_perfil_usuario,
    crear_validacion, listar_validaciones, eliminar_validacion, limpiar_validaciones
)

# =========================================================================
# MAIN.PY - (VERSIÓN INTEGRADA) 
# Intermediario Oficial entre React (Localhost:4321) y el Servidor (8000)
# =========================================================================

app = FastAPI(title="Identera Backend - Integración Total", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

# Aseguramos que la carpeta existe
os.makedirs("uploads", exist_ok=True)
# Servimos estáticamente los archivos subidos para que React pueda leerlos
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# -------------------------------------------------------------
# 1. AUTENTICACIÓN Y USUARIOS
# -------------------------------------------------------------
# Rutas oficiales para el manejo de usuarios conectadas a AWS DynamoDB.
# -------------------------------------------------------------

@app.post("/api/login")
def login(req: LoginRequest):
    """ Verifica las credenciales y da acceso o lo deniega. """
    user = obtener_usuario(req.email)
    
    if not user or user.get("password") != req.password:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas.")
        
    if user.get("status") == "disabled":
        raise HTTPException(status_code=403, detail="Tu cuenta ha sido inhabilitada. Contacta al administrador.")
    
    # Por seguridad no regresamos el password a React
    user_seguro = {k: v for k, v in user.items() if k not in ["password", "PK", "SK", "entity_type"]}
    return user_seguro

@app.get("/api/usuarios")
def get_todos_los_usuarios():
    # Mandamos todos a la tabla del Admin Dashboard
    users = listar_usuarios()
    return [{k: v for k, v in u.items() if k not in ["password", "PK", "SK", "entity_type"]} for u in users]

@app.post("/api/usuarios")
def registrar_usuario(req: UsuarioBase):
    """
    Registra un nuevo usuario en la base de datos.
    Si el usuario es un 'USUARIO' regular, también le pre-genera un carnet en blanco
    para que lo tenga disponible apenas inicie sesión, simulando el comportamiento anterior.
    """
    if obtener_usuario(req.email):
        raise HTTPException(status_code=400, detail="Ya existe un usuario con este correo.")
    
    # Se asegura de generar un ID único si no fue enviado por React
    user_id = req.id or str(uuid.uuid4())
    
    nuevo_user = crear_usuario(
        id=user_id,
        email=req.email,
        name=req.name,
        role=req.role,
        status=req.status,
        password=req.password
    )
    
    # --- FIX: CREACIÓN AUTOMÁTICA DEL CARNET ---
    # Automáticamente le creamos un carnet en la base de datos al registrar un iterante
    if req.role == "USUARIO":
        import random, string
        from datetime import datetime
        # Generar código validador único de 8 caracteres alfanuméricos
        codigo_random = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
        data_carnet = {
            "nombre": req.name,
            "cargo": "Colaborador",
            "arl": "—",
            "eps": "—",
            "cedula": "—",
            "codigoValidador": codigo_random,
            "foto": None
        }
        # Guardamos en la base de datos la validación global simulando que ya se creó
        crear_validacion(
            id=str(uuid.uuid4()), 
            userId=user_id, 
            fecha=datetime.utcnow().isoformat() + "Z", 
            data=data_carnet
        )
        
    return nuevo_user

@app.patch("/api/usuarios/{email}/status")
def actualizar_estado(email: str, req: UpdateStatusRequest):
    user = obtener_usuario(email)
    if not user: raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.get("id") == "admin-id-123":
        raise HTTPException(status_code=400, detail="No puedes inhabilitar al administrador principal.")
        
    user["status"] = req.status
    from database import get_table
    tabla = get_table()
    if tabla:
        tabla.put_item(Item=user)
    return {"status": "success"}

@app.patch("/api/usuarios/{email}/role")
def actualizar_rol(email: str, req: UpdateRoleRequest):
    user = obtener_usuario(email)
    if not user: raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.get("id") == "admin-id-123":
        raise HTTPException(status_code=400, detail="No puedes inhabilitar al administrador principal.")
        
    user["role"] = req.role
    from database import get_table
    tabla = get_table()
    if tabla:
        tabla.put_item(Item=user)
    return {"status": "success"}

@app.patch("/api/usuarios/{email}/profile")
def actualizar_perfil(email: str, req: UpdateUserProfileRequest):
    try:
        nuevo_user = actualizar_perfil_usuario(
            old_email=email,
            new_name=req.name,
            new_email=req.email,
            new_password=req.password
        )
        if not nuevo_user:
            raise HTTPException(status_code=404, detail="Usuario original no encontrado.")
        
        return {k: v for k, v in nuevo_user.items() if k not in ["password", "PK", "SK", "entity_type"]}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/usuarios/{email}")
def borrar_usuario(email: str):
    user = obtener_usuario(email)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    if user.get("id") == "admin-id-123":
        raise HTTPException(status_code=400, detail="Protección de sistema: Imposible eliminar cuenta creadora.")
        
    # Borrar todos los carnets/validaciones asociados a este usuario
    user_id = user.get("id")
    if user_id:
        todas = listar_validaciones()
        for v in todas:
            if v.get("userId") == user_id:
                eliminar_validacion(v.get("id"))
                
    eliminar_usuario(email)
    return {"status": "success"}


# -------------------------------------------------------------
# 2. VALIDACIONES Y ESCANEOS (Sistema Unificado de Carnets)
# -------------------------------------------------------------
# Gestión de la creación y lectura de carnets, soportado directamente
# por la arquitectura de base de datos para sincronización en tiempo real.
# -------------------------------------------------------------

@app.get("/api/validaciones")
def obtener_validaciones(userId: str = None):
    # Si viene userId devolvemos las de él, sino, todas.
    todas = listar_validaciones()
    seguras = [{k: v for k,v in item.items() if k not in ["PK", "SK", "entity_type"]} for item in todas]
    
    if userId:
        return [v for v in seguras if v.get("userId") == userId]
    return seguras

@app.post("/api/validaciones")
def guardar_validacion(req: ValidacionBase, role: str = "USUARIO"):
    """ Guarda el Carnet / Escaneo """
    todas = listar_validaciones()
    
    # Emulamos la lógica original estricta
    if role == "USUARIO":
        # Borra viejas del mismo usuario
        for v in todas:
            if v.get("userId") == req.userId:
                eliminar_validacion(v.get("id"))
    else:
        # Borra viejas repetidas
        for v in todas:
            if v.get("data", {}).get("codigoValidador") == req.data.get("codigoValidador"):
                eliminar_validacion(v.get("id"))

    # Procesamiento de Foto pesada
    # Convertimos la imagen recibida en Base64 a un archivo físico .webp
    # guardando únicamente la URL pública en DynamoDB.
    foto_raw = req.data.get("foto")
    if foto_raw and foto_raw.startswith("data:image"):
        try:
            # Dividimos "data:image/webp;base64," del contenido real
            head, base_str = foto_raw.split(",", 1)
            filename = f"{req.userId}.webp"
            filepath = os.path.join("uploads", filename)
            
            with open(filepath, "wb") as f:
                f.write(base64.b64decode(base_str))
                
            # Sobrescribimos el campo inmenso con una simple ruta
            req.data["foto"] = f"http://127.0.0.1:8000/uploads/{filename}"
        except Exception as e:
            print("Error al procesar la foto:", e)

    crear_validacion(id=req.id, userId=req.userId, fecha=req.fecha, data=req.data)
    
    # Sincronizar info hacia el Perfil del Usuario
    # Actualiza los datos del usuario raíz cuando se edita o crea su carnet.
    usuarios = listar_usuarios()
    for u in usuarios:
        if u.get("id") == req.userId:
            # Encontramos al dueño de este carnet y le actualizamos todo
            u["name"] = req.data.get("nombre", u.get("name")) # Sobrescribe el nombre por el del carnet si existe
            u["cargo"] = req.data.get("cargo", "—")
            u["cedula"] = req.data.get("cedula", "—")
            u["arl"] = req.data.get("arl", "—")
            u["eps"] = req.data.get("eps", "—")
            u["codigoValidador"] = req.data.get("codigoValidador", "—")
            # Para la foto, solo la guardamos si no es nula para no borrar una existente erróneamente
            if req.data.get("foto"):
                u["foto"] = req.data.get("foto")
            
            # Guardamos la actualización directamente en la tabla
            from database import get_table
            tabla = get_table()
            if tabla:
                tabla.put_item(Item=u)
            break

    return obtener_validaciones() # Devuelve toda la lista 

@app.delete("/api/validaciones/{id}")
def borrar_validacion(id: str):
    eliminar_validacion(id)
    return obtener_validaciones()

@app.delete("/api/validaciones/all/clear")
def borrar_todas_validaciones():
    limpiar_validaciones()
    return []

# -------------------------------------------------------------
# AWS LAMBDA HANDLER
# -------------------------------------------------------------
# Mangum envuelve la app de FastAPI para ser ejecutada en AWS Lambda
handler = Mangum(app)

