# Guía completa: API ECA MID en Coolify + GitHub

Arquitectura objetivo:

| Pieza | Dónde | URL |
|--------|--------|-----|
| Frontend | Cloudflare Pages (después) | `https://eca360.com.mx` |
| API + SQLite + uploads | Coolify en tu VPS | `https://api.eca360.com.mx` |

Repo GitHub: `https://github.com/desarrolloAmerisa/ECA360_PAGE.git`

---

## 0) Antes de tocar Coolify (en tu PC)

### 0.1 Subir el código a GitHub

En Coolify el build sale del repo. Asegúrate de que `main` tenga:

- `deploy/Dockerfile.api`
- `deploy/entrypoint.api.sh`
- `deploy/docker-compose.coolify.yml` (opcional)
- `backend/app/db_migrate.py`
- `frontend/.env.production` (para el front después)

```bash
cd "c:\ALAN PROYECTS\blog eca 360"
git status
git add deploy/Dockerfile.api deploy/entrypoint.api.sh deploy/docker-compose.coolify.yml deploy/coolify.env.example deploy/COOLIFY.md backend/app/db_migrate.py backend/app/main.py frontend/.env.production frontend/.env.example frontend/public/_redirects frontend/src/services/api.js
git commit -m "Add Coolify API deploy with auto-migrations and production API URL"
git push origin main
```

### 0.2 Tener listo el backup

Carpeta `backup-vps` (o como la tengas):

- Archivo SQLite de producción (ej. `eca360.db`)
- Carpeta `uploads/` con `images/`, `videos/`, `thumbnails/`

Lo vas a copiar al volume `/data` del contenedor después del primer deploy.

---

## 1) VPS + Coolify

### 1.1 VPS

- Ubuntu 22.04/24.04 (o el que uses con Coolify)
- Mínimo recomendado: 1–2 GB RAM, 20+ GB disco (por fotos/videos)
- IP pública fija
- Puertos **80** y **443** abiertos (firewall del cloud + UFW si aplica)

### 1.2 Instalar Coolify

En el VPS (como root o con sudo), sigue la instalación oficial de Coolify (script actual de su docs). Ejemplo típico:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Al terminar abre:

`http://IP_DEL_VPS:8000`  
(o el puerto que indique el instalador)

Crea la cuenta admin de Coolify.

### 1.3 Servidor en Coolify

1. Coolify → **Servers**
2. Debe aparecer el servidor local (localhost) ya conectado
3. Si usas otro nodo, agrégalo con el agente de Coolify

### 1.4 DNS (hazlo ya, aunque el cert tarde un poco)

En tu DNS (Cloudflare DNS del dominio `eca360.com.mx`):

| Tipo | Nombre | Contenido | Proxy |
|------|--------|-----------|--------|
| A | `api` | `IP_DEL_VPS` | DNS only (gris) al inicio, o proxied si sabes manejar SSL |

Recomendación al principio: **DNS only** (nube gris) para que Coolify emita el certificado Let's Encrypt sin pelear con el proxy naranja. Luego puedes poner proxy naranja si quieres.

Espera a que `api.eca360.com.mx` resuelva a la IP del VPS:

```bash
nslookup api.eca360.com.mx
```

---

## 2) Conectar GitHub a Coolify

### 2.1 Source / GitHub App

1. Coolify → **Sources** (o **Settings → Git**)
2. **Add GitHub App** (o Private Key / Deploy Key, según tu Coolify)
3. Autoriza el acceso a la org/usuario `desarrolloAmerisa`
4. Da permiso al repo **`ECA360_PAGE`**

Si el repo es privado, la GitHub App o el deploy key son obligatorios.

### 2.2 (Alternativa) Deploy Key manual

Si no usas GitHub App:

1. Coolify genera una SSH public key al crear el resource
2. En GitHub → repo → **Settings → Deploy keys → Add deploy key**
3. Pega la clave pública (read-only)

---

## 3) Crear el servicio API en Coolify

### 3.1 Nuevo resource

1. **Projects** → crea/elige un proyecto (ej. `ECA MID`)
2. **+ New Resource** → **Public Repository** o **Private Repository** (GitHub)
3. Elige:
   - Source: tu GitHub
   - Repository: `desarrolloAmerisa/ECA360_PAGE`
   - Branch: `main`

### 3.2 Build Pack = Dockerfile

Configura así:

| Campo | Valor |
|--------|--------|
| Build Pack | **Dockerfile** |
| Base Directory | `/` (raíz del repo) |
| Dockerfile Location | `deploy/Dockerfile.api` |
| Docker Build Context | `/` o `.` (raíz) |
| Port | **8000** |
| Is it a static site? | **No** |

> No uses el Dockerfile del frontend. Solo `deploy/Dockerfile.api`.

### 3.3 Dominio

1. En el resource → **Domains** / **Network**
2. Agrega: `https://api.eca360.com.mx`
3. Activa generación de certificado (Let's Encrypt) — Coolify/Traefik lo hace solo si el DNS apunta al VPS

### 3.4 Volume persistente (BD + fotos)

Esto es crítico. Sin volume, al redesplegar pierdes la BD.

1. Resource → **Storages** / **Persistent Storage**
2. Añade volume:

| Campo | Valor |
|--------|--------|
| Destination path (en el contenedor) | `/data` |
| Nombre del volume | `eca360_data` (o el que Coolify asigne) |

Contenido esperado:

```text
/data/eca360.db
/data/uploads/images/...
/data/uploads/videos/...
/data/uploads/thumbnails/...
```

### 3.5 Variables de entorno

Resource → **Environment Variables** (o .env):

```env
ADMIN_PASSWORD=TU_CLAVE_FUERTE
DATABASE_URL=sqlite:////data/eca360.db
UPLOAD_DIR=/data/uploads
CORS_ORIGINS=https://eca360.com.mx,https://www.eca360.com.mx
APP_URL=https://eca360.com.mx
API_URL=https://api.eca360.com.mx
APP_NAME=ECA MID
HOST=0.0.0.0
PORT=8000
```

Notas:

- `DATABASE_URL` lleva **cuatro** slashes: `sqlite:////data/eca360.db` (ruta absoluta en Linux).
- Cuando tengas el front en Cloudflare, `CORS_ORIGINS` debe incluir exactamente esas URLs (con `https://`).
- Si pruebas el front en `*.pages.dev`, agrégalo también a `CORS_ORIGINS`.

### 3.6 Healthcheck (opcional pero útil)

Si Coolify lo permite:

- Path: `/health`
- Port: `8000`

### 3.7 Primer deploy

1. **Deploy** / **Redeploy**
2. Mira los logs. Debes ver algo como:

```text
==> Migraciones
[migrate] DATABASE_URL=sqlite:////data/eca360.db
[migrate] BD vacía → alembic upgrade head
==> Uvicorn :8000
```

3. Prueba:

```text
https://api.eca360.com.mx/health
https://api.eca360.com.mx/docs
```

Si `/health` responde `{"status":"ok",...}`, el API ya está vivo (aún sin tus eventos de producción).

---

## 4) Restaurar la BD y los archivos de `backup-vps`

Hazlo **después** del primer deploy exitoso (así ya existe el volume `/data`).

### 4.1 Identificar el contenedor

En el VPS:

```bash
docker ps | grep -i eca
# anota el CONTAINER_ID o nombre
```

O usa la terminal/Shell de Coolify del resource.

### 4.2 Subir el backup al VPS

Desde tu PC (PowerShell o scp), sube `backup-vps` al VPS, por ejemplo a `/root/backup-vps`:

```bash
scp -r "./backup-vps" root@IP_DEL_VPS:/root/backup-vps
```

Ajusta el nombre del archivo `.db` al real (a veces es `eca360.db`).

### 4.3 Copiar al volume del contenedor

En el VPS (sustituye `CONTAINER` y la ruta del `.db`):

```bash
# Parar el servicio desde Coolify (Stop) evita escrituras a medias — recomendado

docker cp /root/backup-vps/eca360.db CONTAINER:/data/eca360.db
docker cp /root/backup-vps/uploads/. CONTAINER:/data/uploads/

# Permisos por si acaso
docker exec CONTAINER chown -R root:root /data
```

Si tu backup tiene otra estructura (ej. `images/` sueltas), deja todo bajo `/data/uploads/` así:

```text
/data/uploads/images
/data/uploads/videos
/data/uploads/thumbnails
```

### 4.4 Reiniciar (corre la migración sola)

1. Coolify → **Restart** / **Redeploy** del API  
2. En logs deberías ver algo como:

```text
[migrate] BD existente sin alembic_version → ensure columns + stamp head
[migrate] Columna comments.rating agregada (default 5)   # solo si faltaba
[migrate] OK
```

Los comentarios viejos quedan con **5 estrellas** por defecto.

### 4.5 Verificar datos

```text
https://api.eca360.com.mx/events
https://api.eca360.com.mx/uploads/images/ALGUNA_FOTO.jpg
https://api.eca360.com.mx/admin/login   # POST desde el front; en docs puedes probar auth
```

---

## 5) Auto-deploy desde GitHub (opcional pero recomendado)

1. En el resource Coolify → **Webhooks** / **Git**
2. Activa deploy on push a `main`
3. Coolify te da una URL de webhook → agréguela en GitHub:

   Repo → **Settings → Webhooks → Add webhook**  
   - Payload URL: la de Coolify  
   - Content type: `application/json`  
   - Eventos: just the push event  

Cada `git push origin main` redespliega la API.  
**El volume `/data` no se borra** en un redeploy normal: la BD y uploads se mantienen.

---

## 6) Checklist final del backend

- [ ] Código pusheado a `main` en GitHub
- [ ] Coolify instalado en el VPS
- [ ] DNS `api.eca360.com.mx` → IP del VPS
- [ ] Resource Dockerfile `deploy/Dockerfile.api`
- [ ] Volume `/data`
- [ ] Env vars configuradas (`ADMIN_PASSWORD`, `CORS_ORIGINS`, etc.)
- [ ] HTTPS OK en `https://api.eca360.com.mx/health`
- [ ] Backup restaurado en `/data`
- [ ] `/events` lista eventos reales
- [ ] Una imagen de `/uploads/...` abre en el navegador
- [ ] Webhook de GitHub (opcional)

---

## 7) Qué sigue (frontend — después)

1. Cloudflare Pages → root `frontend`, build `npm ci && npm run build`, output `dist`
2. Env de build: `VITE_API_URL=https://api.eca360.com.mx`
3. Dominio `eca360.com.mx` / `www`
4. Confirmar que `CORS_ORIGINS` del API incluye esas URLs

---

## Problemas comunes

| Síntoma | Qué revisar |
|---------|-------------|
| Build falla “Dockerfile not found” | Context = raíz; path = `deploy/Dockerfile.api` |
| 502 en el dominio | Contenedor caído; logs; puerto 8000; DNS |
| Certificado SSL falla | DNS apunta al VPS; puerto 80 abierto; prueba DNS only |
| `/events` vacío tras restore | No copiaste el `.db` a `/data/eca360.db` o mal nombre |
| Fotos 404 | `uploads` no están en `/data/uploads/...` |
| CORS error desde el front | Falta el origen del front en `CORS_ORIGINS` |
| Pierdes datos al redeploy | No configuraste volume en `/data` |
