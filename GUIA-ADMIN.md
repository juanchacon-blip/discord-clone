# Cuenta administradora

## Que puede hacer

Desde **🛡️ Administracion** (boton en la barra izquierda, solo visible para el admin; tambien en `tu-app/#admin`):

- Ver todos los canales con cuantos mensajes y archivos tiene cada uno.
- **Eliminar un canal** completo (mensajes y archivos incluidos). Pide escribir el nombre para confirmar.
- **Eliminar un mensaje** (y su archivo, si tenia).
- **Eliminar solo la imagen/archivo** de un mensaje. Si el mensaje tenia texto, el texto se queda; si no, se borra todo.
- Filtrar "Solo mensajes con archivos" para limpiar imagenes mas rapido.

Los cambios se ven en vivo para todos los usuarios conectados.

## Como se elige quien es admin

Con una variable de entorno en el servidor (en Render: Environment):

```
ADMIN_EMAILS = tu-correo@gmail.com
```

- Puedes poner varios separados por coma.
- El correo debe estar **verificado** en Auth0 (con "Continuar con Google" ya lo esta).
  Si no esta verificado, el acceso se niega a proposito (si no, cualquiera podria registrarse con tu correo).
- Si por algun motivo no funciona, usa el **ID de cuenta**: abre ⚙️ Configuracion, copia el texto de
  "ID de cuenta" (algo como `google-oauth2|1234...`) y ponlo en:

```
ADMIN_SUBS = google-oauth2|1234...
```

Despues de cambiar las variables Render reinicia solo. Cierra sesion y vuelve a entrar si el boton no aparece.

## Seguridad

- La proteccion esta en el **servidor**: toda ruta `/admin/...` responde 403 si la cuenta no es admin.
  Aunque alguien escriba `#admin` en la URL, solo vera "solo para administradores" y el servidor rechazaria cualquier accion.
- Cada borrado queda registrado en los logs de Render con la etiqueta `AUDITORIA` (quien, que y cuando).
- Borrar es **definitivo**: no hay papelera.
- El admin borra lo que esta en el almacenamiento del proyecto (Supabase). **No toca los respaldos
  que cada usuario tiene en su propio Google Drive**; esos son de cada persona.
- Si un archivo no se puede borrar de Supabase, el panel avisa (el mensaje ya desaparecio del chat) y el detalle queda en los logs.
