# wa-easy

Wrapper simplificado sobre [`@neoxr/wb`](https://github.com/neoxr/neoxr-bot) (Baileys) para crear bots de WhatsApp con muy poco código.

En lugar de configurar `Client`, parsear prefijos, manejar plugins y recordar firmas largas como `client.sendFile(m.chat, url, 'image.jpg', 'caption', m)`, escribes:

```js
import { createBot } from 'wa-easy'

const bot = createBot({ number: '5215512345678', owners: ['5215512345678'] })

bot.command('ping', (ctx) => ctx.reply('🏓 Pong!'))
bot.start()
```

> **Solo ESM.** Requiere Node 18+ y que tu proyecto tenga `"type": "module"` en `package.json`.

---

## Índice

1. [Instalación](#instalación)
2. [Inicio rápido](#inicio-rápido)
3. [Opciones de `createBot`](#opciones-de-createbot)
4. [Comandos, frases y middlewares](#comandos-frases-y-middlewares)
5. [El objeto `ctx`](#el-objeto-ctx)
6. [Métodos de `ctx`](#métodos-de-ctx) (texto, archivos, interactivos, otros)
7. [Builders: `Btn`, `card`, `Meta`](#builders-btn-card-meta)
8. [Eventos](#eventos)
9. [Métodos del bot](#métodos-del-bot)
10. [Equivalencias con la API original](#equivalencias-con-la-api-original)
11. [Notas y solución de problemas](#notas-y-solución-de-problemas)

---

## Instalación

```bash
npm install @neoxr/wb baileys
# copia la carpeta wa-easy a tu proyecto, o publícala como paquete propio
```

`package.json` de tu proyecto:

```json
{ "type": "module" }
```

Estructura sugerida:

```
mi-proyecto/
├─ wa-easy/          ← este wrapper
│  └─ index.js
├─ bot.js
└─ package.json
```

---

## Inicio rápido

```js
// bot.js
import { createBot } from './wa-easy/index.js'

const bot = createBot({
   name: 'Mi Bot',
   number: '5215512345678',      // con número => pairing code. Sin número => QR
   owners: ['5215512345678']
})

bot.command('ping', (ctx) => ctx.reply('🏓 Pong!'))

bot.command('eco', (ctx) => ctx.reply(ctx.text || 'Escribe algo'), {
   description: 'Repite tu texto',
   usage: '<texto>'
})

bot.start()
```

Ejecuta `node bot.js`, introduce el código de emparejamiento en WhatsApp (*Dispositivos vinculados → Vincular con número de teléfono*) y escribe `.ping` o `.menu`.

Un ejemplo completo está en [`example/bot.js`](./example/bot.js).

---

## Opciones de `createBot`

Todas son opcionales.

| Opción | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `name` | `string` | `'Bot'` | Nombre del bot (menú, títulos de previews y meta-mensajes). |
| `footer` | `string` | `name` | Footer por defecto de `ctx.buttons()`. |
| `number` | `string` | — | Número del bot. Si lo pones usa **pairing code**; si no, **QR**. |
| `pairingCode` | `string` | — | Código de emparejamiento personalizado (8 caracteres alfanuméricos). |
| `owners` | `string[]` | `[]` | Números de los dueños (solo dígitos). Habilita `ctx.isOwner` y `{ owner: true }`. |
| `prefixes` | `string[]` | `['.', '#', '!', '/']` | Prefijos de comandos. |
| `noPrefix` | `boolean` | `false` | Si es `true`, `ping` funciona igual que `.ping`. |
| `ignoreSelf` | `boolean` | `true` | Ignora mensajes enviados por el propio bot. Ponlo en `false` si usas *selfbot*. |
| `ignoreBots` | `boolean` | `true` | Ignora mensajes de otros bots (detectados por `isBot`). |
| `help` | `boolean \| { command }` | `true` | Registra un comando de ayuda automático (`.menu` y `.help`). |
| `replyOnError` | `boolean` | `true` | Responde con un mensaje de error si un comando lanza una excepción. |
| `messages` | `object` | ver abajo | Textos de `owner`, `group`, `private`, `cooldown(s)` y `error`. |
| `packname` / `author` | `string` | `'Sticker by'` / `''` | Metadatos por defecto de los stickers. |
| `session` | `string` | `'session'` | Nombre/carpeta de la sesión. |
| `store` | `'local' \| 'mongo' \| 'postgres' \| 'mysql' \| 'sqlite' \| 'redis'` | `'local'` | Tipo de almacenamiento de sesión. |
| `databaseUrl` | `string` | `process.env.DATABASE_URL` | URL/config del almacenamiento (si no es `local`). |
| `plugins` | `string` | — | Carpeta de plugins ESM de `@neoxr/wb` (`plugsdir`). Opcional. |
| `id` | `string` | `'bot'` | `custom_id` de la librería. |
| `presence` / `online` / `bypassDisappearing` | `boolean` | `true` | Opciones pasadas a la librería. |
| `stealth` | `'ios' \| 'android' \| 'web' \| 'dekstop'` | — | Modo stealth anti-detección. |
| `isBot` | `(id) => boolean` | detector de IDs de bots | Cómo reconocer mensajes de otros bots. |
| `setting` | `any` | — | Se pasa tal cual a `setting` de la librería. |
| `baileys` | `object` | — | Opciones extra de Baileys (se mezclan con `version`, `browser`, `shouldIgnoreJid`). |
| `debug` | `boolean` | `false` | Modo debug de la librería. |

Mensajes por defecto (puedes sobrescribir cualquiera):

```js
createBot({
   messages: {
      owner: '⛔ Solo mi dueño puede usar esto.',
      cooldown: (s) => `Calma, espera ${s}s`
   }
})
```

---

## Comandos, frases y middlewares

### `bot.command(nombres, handler, meta?)`

```js
bot.command('ping', (ctx) => ctx.reply('pong'))

// con alias (el primero es el nombre, los demás son alias)
bot.command(['sticker', 's', 'stiker'], (ctx) => ctx.sticker(ctx.quoted?.fakeObj ?? 'https://...'))

// con opciones
bot.command('ban', handler, {
   description: 'Banea a un usuario',
   usage: '@usuario',
   category: 'admin',
   group: true,       // solo en grupos
   owner: true,       // solo owners
   cooldown: 10       // segundos entre usos por usuario (los owners no tienen cooldown)
})
```

| `meta` | Descripción |
|---|---|
| `description`, `usage`, `category` | Se muestran en el menú automático. `category` por defecto: `'general'`. |
| `aliases` | Alias adicionales (`string[]`). |
| `owner` | Solo owners. |
| `group` | Solo en grupos. |
| `private` | Solo en chat privado. |
| `cooldown` | Segundos de espera por usuario. |
| `hidden` | No aparece en el menú. |

### `bot.hears(patrón, handler)`

Reacciona a mensajes **sin prefijo**. Solo se ejecuta si el mensaje no era un comando registrado. Se usa el primer patrón que coincida.

```js
bot.hears('hola', (ctx) => ctx.reply('¡Hola! 👋'))                   // contiene "hola" (sin distinguir mayúsculas)
bot.hears(/^precio (\w+)/i, (ctx) => ctx.reply(`Buscando ${ctx.match[1]}`)) // RegExp => ctx.match
bot.hears((ctx) => ctx.isGroup && ctx.body.length > 500, (ctx) => ctx.react('🥱')) // función
```

### `bot.use(middleware)`

Se ejecutan antes de los comandos, en orden. Si no llamas a `next()`, la cadena se detiene (útil para bloquear usuarios, modo mantenimiento, logs, etc.).

```js
// log
bot.use(async (ctx, next) => {
   console.log(ctx.pushName, '→', ctx.body)
   await next()
})

// lista negra
const baneados = new Set(['5215500000000'])
bot.use(async (ctx, next) => {
   if (baneados.has(ctx.number)) return   // no llama a next => se ignora
   await next()
})
```

### Menú automático

Con `help: true` (por defecto) el bot registra `.menu` / `.help`, agrupado por `category`. Si defines tu propio comando `menu` o `help`, el tuyo tiene prioridad. Para cambiar el nombre: `createBot({ help: { command: 'ayuda' } })`.

---

## El objeto `ctx`

Cada handler recibe un `ctx` (instancia de `Context`).

| Propiedad | Descripción |
|---|---|
| `ctx.chat` | JID del chat (usuario o grupo). |
| `ctx.sender` | JID de quien escribió. |
| `ctx.number` | Número del remitente (solo dígitos). |
| `ctx.tag` | `@número`, listo para mencionar. |
| `ctx.pushName` | Nombre público del remitente. |
| `ctx.body` | Texto completo del mensaje. |
| `ctx.prefix` | Prefijo usado (`'.'`, `'!'`...) o `null`. |
| `ctx.command` | Nombre del comando en minúsculas (`'ping'`). |
| `ctx.args` | Argumentos separados por espacios (`string[]`). |
| `ctx.text` | Todo lo que va después del comando (conserva saltos de línea). |
| `ctx.match` | Resultado del `RegExp` cuando se usa `bot.hears()`. |
| `ctx.isGroup` | `true` si es un grupo. |
| `ctx.isOwner` | `true` si el remitente está en `owners`. |
| `ctx.fromMe` | `true` si lo envió el propio bot. |
| `ctx.type` | Tipo de mensaje (`mtype`, p. ej. `'extendedTextMessage'`). |
| `ctx.quoted` | Mensaje citado o `null`. |
| `ctx.mentions` | JIDs mencionados. |
| `ctx.id` | ID del mensaje. |
| `ctx.m` | Mensaje original de la librería. |
| `ctx.raw` | Evento completo de `@neoxr/wb` (`{ m, body, prefix, ... }`). |
| `ctx.sock` | Socket de Baileys con todas las funciones originales. |
| `ctx.bot` | La instancia del bot. |

Ejemplo:

```js
bot.command('info', (ctx) => ctx.reply(
`👤 ${ctx.pushName} (${ctx.number})
💬 Chat: ${ctx.isGroup ? 'grupo' : 'privado'}
🔧 Comando: ${ctx.command}
📎 Args: ${ctx.args.join(', ') || '(ninguno)'}
👑 Owner: ${ctx.isOwner ? 'sí' : 'no'}`))
```

---

## Métodos de `ctx`

Todos devuelven una `Promise`. Úsalos con `await` si necesitas el orden.

### Texto

| Método | Descripción |
|---|---|
| `ctx.reply(texto, opts?)` | Responde citando el mensaje. |
| `ctx.whisper(texto)` | Responde en un grupo pero **solo lo ve quien escribió** (`exclusive`). |
| `ctx.react(emoji = '👍')` | Reacciona al mensaje. |
| `ctx.progress(texto)` | Texto con barra de progreso. |
| `ctx.ai(texto)` | Texto con etiqueta "AI" (solo WhatsApp Business). |
| `ctx.verified(texto, etiqueta?)` | Texto con "fake quoted" verificado. |
| `ctx.preview(texto, opts)` | Texto con miniatura/preview personalizado. |
| `ctx.fakeReply(texto, etiqueta, opts)` | Preview con fake quoted. |

```js
bot.command('hola', async (ctx) => {
   await ctx.react('👋')
   await ctx.reply(`Hola ${ctx.tag}!`, { mentions: [ctx.sender] })
})

bot.command('privado', (ctx) => ctx.whisper('Este mensaje solo lo ves tú'), { group: true })

// Preview con miniatura grande
bot.command('promo', (ctx) => ctx.preview('Visita nuestra web', {
   title: '© Mi Bot',
   thumbnail: 'https://iili.io/HP3ODj2.jpg',   // URL o Buffer
   url: 'https://example.com',
   large: true
}))

// Preview estilo "link" (ratio: landscape | portrait | square)
bot.command('link', (ctx) => ctx.preview('Mira esto', {
   link: true,
   ratio: 'square',
   title: 'Mi sitio',
   thumbnail: 'https://iili.io/HP3ODj2.jpg',
   icon: 'https://iili.io/HP3ODj2.jpg',
   url: 'https://example.com'
}))

bot.command('verificado', (ctx) => ctx.verified('Mensaje oficial', '© Mi Bot'))
```

### Archivos y multimedia

Todas las fuentes aceptan **ruta local, URL o Buffer**.

| Método | Descripción |
|---|---|
| `ctx.image(src, caption?)` | Imagen. |
| `ctx.video(src, caption?)` | Video. |
| `ctx.audio(src, { cover }?)` | Audio. `cover` = Buffer con la carátula. |
| `ctx.voice(src)` | Nota de voz. |
| `ctx.document(src, filename, caption?)` | Archivo como documento. |
| `ctx.file(src, filename, caption, opts?)` | Envío genérico (detecta la extensión). |
| `ctx.photoLive(src, caption?, { thumbnail }?)` | Video como *photo live*. |
| `ctx.ptv(src)` | Video circular (máx. 10 s). |
| `ctx.sticker(src, { packname, author, type }?)` | Sticker. `type`: `'normal'` (def.), `'meta'`, `'lock'`, `'premium'`. |
| `ctx.album(items)` | Álbum. Items: URL (string) o `{ url, caption?, type? }`. |

```js
bot.command('foto', (ctx) => ctx.image('https://iili.io/HP3ODj2.jpg', 'Aquí tienes'))
bot.command('mp3', (ctx) => ctx.audio('./media/audio/ah.mp3'))
bot.command('nota', (ctx) => ctx.voice('./media/audio/ah.mp3'))
bot.command('pdf', (ctx) => ctx.document('./docs/manual.pdf', 'manual.pdf', 'Manual de uso'))

bot.command('sticker', (ctx) => ctx.sticker('https://iili.io/HP3ODj2.jpg', {
   packname: 'Mi pack',
   author: 'Yo',
   type: 'meta'                  // sticker "AI"
}))

bot.command('album', (ctx) => ctx.album([
   'https://i.pinimg.com/736x/6f/a3/6a/6fa36aa2c367da06b2a4c8ae1cf9ee02.jpg',
   { url: 'https://i.pinimg.com/736x/0b/97/6f/0b976f0a7aa1aa43870e1812eee5a55d.jpg', caption: 'Segunda' }
]))
```

### Interactivos

#### Encuestas

```js
// Simple
ctx.poll('¿Te gusta esta librería?', ['Sí', 'No'])

// Selección múltiple
ctx.poll('¿Qué lenguajes usas?', ['JS', 'Python', 'Go'], { multiselect: true })

// Con imágenes
ctx.poll('Elige uno:', [
   { name: 'menu', image: 'https://i.pinimg.com/736x/89/8c/5c/898c5cd36ce73762b57e0c3f39d61157.jpg' },
   { name: 'runtime', image: 'https://i.pinimg.com/736x/4d/67/5a/4d675afa9a7a4ec4ee934484c615e0bf.jpg' }
])

// Resultado de encuesta (array o diccionario)
ctx.pollResult('Resultados', { 'Opción A': 1500, 'Opción B': 200 })
ctx.pollResult('Resultados', [{ name: 'Opción A', count: 1500 }, { name: 'Opción B', count: 200 }])
```

#### Contactos

```js
ctx.contact({ name: 'Soporte', number: '5215512345678', about: 'Atención al cliente' }, {
   org: 'Mi Empresa',
   website: 'https://example.com',
   email: 'contacto@example.com'
})

// Varios contactos
ctx.contact([
   { name: 'Ana', number: '5215511111111' },
   { name: 'Luis', number: '5215522222222' }
])
```

#### Botones clásicos — `ctx.buttons(texto, botones, opts?)`

`texto` no puede ir vacío. `@0` menciona al usuario.

```js
const botones = [
   { text: 'Runtime', command: '.runtime' },
   { text: 'Estadísticas', command: '.stat' }
]

// Solo texto
ctx.buttons('Hola @0', botones)

// Con imagen o video
ctx.buttons('Hola @0', botones, { media: 'https://iili.io/HP3ODj2.jpg', footer: 'Mi Bot' })

// Con documento
ctx.buttons('Hola @0', botones, { media: 'https://iili.io/HP3ODj2.jpg', document: { filename: 'neoxr.jpg' } })

// Con ubicación
ctx.buttons('Hola @0', botones, {
   media: 'https://iili.io/HP3ODj2.jpg',
   location: { name: 'Mi Bot', description: 'Automatización' }
})
```

#### Botones nativos y listas — `ctx.interactive(contenido, botones, opts?)`

> Estos mensajes dependen de WhatsApp y pueden dejar de funcionar o provocar bloqueos (la librería original dice "bajo tu propio riesgo").

```js
import { Btn } from './wa-easy/index.js'

ctx.interactive('¿Qué quieres hacer?', [
   Btn.reply('Owner', '.owner'),
   Btn.url('Web', 'https://example.com'),
   Btn.copy('Copiar código', '123456'),
   Btn.call('Llamar', '5215512345678'),
   Btn.list('Más opciones', [
      { title: 'Owner',   description: 'Contacto', command: '.owner' },
      { title: 'Runtime', description: 'Tiempo activo', command: '.runtime' }
   ])
], {
   header: 'Menú',
   footer: 'Mi Bot',
   media: 'https://iili.io/HP3ODj2.jpg',   // imagen o video
   // v2: true                              // estilo producto con imagen
})

// Varias listas en un mismo mensaje
ctx.interactive('Hola', botones, {
   media: 'https://iili.io/HP3ODj2.jpg',
   multiple: { name: 'Automatización', code: 'mi-bot', list_title: 'Selecciona', button_title: 'Pulsa aquí' }
})
```

#### Carrusel — `ctx.carousel(tarjetas, { content })`

```js
import { Btn, card } from './wa-easy/index.js'

ctx.carousel([
   card({ image: 'https://iili.io/HP3ODj2.jpg', text: 'Producto 1', buttons: [Btn.url('Ver', 'https://example.com/1')] }),
   card({ image: 'https://iili.io/HP3ODj2.jpg', text: 'Producto 2', buttons: [Btn.url('Ver', 'https://example.com/2')] })
], { content: 'Nuestro catálogo' })
```

#### Mensajes *rich* — `ctx.meta(bloques, { title, mentions })`

Los strings sueltos se convierten en texto automáticamente.

```js
import { Meta } from './wa-easy/index.js'

ctx.meta([
   `Hola ${ctx.tag} ✨, esto soporta *menciones*, *tablas* y *código*.`,
   Meta.code(`console.log('hola')`, 'javascript'),
   Meta.table(['Código', 'Nombre'], [['A-1', 'Ana'], ['B-2', ctx.tag]], 'Datos'),
   Meta.muted('Texto atenuado'),
   Meta.suggestions('Opción 1', 'Opción 2'),
   Meta.sources([{ icon: 'https://.../icon.jpg', title: 'GitHub', url: 'https://github.com/neoxr/neoxr-bot' }])
], { title: 'Mi Bot', mentions: [ctx.sender] })
```

Productos, posts y reels:

```js
ctx.meta([
   'Un producto simple:',
   Meta.products({
      title: 'Script Bot', image: 'https://.../img.jpg', sale_price: '$10', brand: 'Mi marca', url: 'https://example.com'
   }),
   '\nUn slide de productos:',
   Meta.products([
      { title: 'A', image: 'https://.../a.jpg', sale_price: '$5', brand: 'Mi marca', url: 'https://example.com/a' },
      { title: 'B', image: 'https://.../b.jpg', price: '$9', sale_price: '$7', brand: 'Mi marca', url: 'https://example.com/b' }
   ]),
   '\nPosts:',
   Meta.posts([{
      username: 'mi_cuenta', avatar: 'https://.../avatar.jpg', verified: true,
      caption: 'Hola mundo', url: 'https://example.com', thumbnail: 'https://.../post.jpg',
      source: 'INSTAGRAM', post_type: 'PHOTO'
   }]),
   '\nReels:',
   Meta.reels([{
      creator: 'mi_cuenta', avatar: 'https://.../avatar.jpg', verified: true,
      thumbnail: 'https://.../reel.jpg', url: 'https://example.com', source: 'IG'
   }])
])
```

### Otros

| Método | Descripción |
|---|---|
| `ctx.forward(jid?)` | Reenvía el mensaje actual (por defecto al mismo chat). |
| `ctx.groupStatus(contenido, opts?)` | Publica un estado de grupo. |

```js
// Texto
ctx.groupStatus({ text: 'Hola!', background: '#FF0000', color: '#222222' })
ctx.groupStatus('Hola!')                                    // atajo para texto

// Imagen / video
ctx.groupStatus({ media: 'https://.../foto.jpg', caption: 'Hola!' })

// Audio
ctx.groupStatus({ media: 'https://example.com/audio.mp3', background: '#FF0000' })

// Amigos cercanos
ctx.groupStatus({ text: 'Hola!' }, { private: { name: 'Mi círculo', emoji: '🔥' } })

// Instantáneo desde un mensaje citado
ctx.groupStatus(ctx.quoted.fakeObj, { private: { name: 'Mi círculo', emoji: '🔥' } })
```

---

## Builders: `Btn`, `card`, `Meta`

Funciones que construyen los objetos complicados de la API original.

| Builder | Resultado |
|---|---|
| `Btn.reply(texto, id)` | Botón de respuesta rápida (`quick_reply`). |
| `Btn.url(texto, url)` | Abre un enlace (`cta_url`). |
| `Btn.copy(texto, código)` | Copia al portapapeles (`cta_copy`). |
| `Btn.call(texto, número)` | Llama (`cta_call`). |
| `Btn.list(título, filas)` | Lista desplegable (`single_select`). Filas: `{ title, description?, command \| id }`. |
| `card({ image, text, buttons })` | Tarjeta de carrusel. |
| `Meta.text / code / table / muted / suggestions / sources / reels / posts / products` | Bloques de `ctx.meta()`. |

---

## Eventos

`bot.on(evento, handler)` (el bot es un `EventEmitter`).

| Evento | Argumentos | Descripción |
|---|---|---|
| `message` | `ctx` | **Todos** los mensajes, ya envueltos en `Context` (útil para logs o lógica propia). |
| `command.unknown` | `ctx` | Se usó un prefijo pero el comando no existe. |
| `error` | `err, ctx?` | Errores de la librería o de un handler. Si no escuchas `error`, se imprime en consola. |
| `connect`, `ready` | — | Estado de la conexión. |
| `group.add`, `group.remove`, `group.promote`, `group.demote`, `group.request` | `ctx` *(original)* | Eventos de grupo. |
| `stories`, `message.delete`, `message.receipt`, `caller`, `poll`, `presence.update`, `lid-mapping` | `ctx` *(original)* | Se reenvían tal cual desde `@neoxr/wb`. |

> Los eventos marcados como *(original)* entregan el objeto sin modificar de `@neoxr/wb`; su forma depende de la librería.

```js
bot.on('ready', () => console.log('✅ Listo'))

bot.on('command.unknown', (ctx) => ctx.reply(`No conozco ".${ctx.command}". Prueba ${ctx.prefix}menu`))

bot.on('group.add', (ctx) => console.log('Alguien entró al grupo', ctx))

bot.on('error', (err, ctx) => console.error('Falló', ctx?.command, err))
```

Eventos nativos de Baileys (`messages.upsert`, `groups.update`, ...) están disponibles en `bot.lib.ev` una vez llamado `start()`:

```js
bot.start()
bot.lib.ev.on('messages.reaction', (u) => console.log(u))
```

---

## Métodos del bot

| Método | Descripción |
|---|---|
| `bot.start()` | Crea la conexión. Llámalo una vez, después de registrar tus comandos. |
| `bot.command(...)`, `bot.hears(...)`, `bot.use(...)` | Registro (encadenables). |
| `bot.sendText(jid, texto, extra?)` | Envía texto a cualquier JID sin necesidad de un mensaje previo. |
| `bot.helpText(ctx?)` | Genera el texto del menú. |
| `bot.sock` | Socket de Baileys (tras `start()`). |
| `bot.lib` | Instancia original de `@neoxr/wb` `Client`. |
| `bot.commands` | `Map` de comandos registrados. |

```js
// Mensaje proactivo a un dueño al iniciar
bot.on('ready', () => bot.sendText('5215512345678@s.whatsapp.net', '🟢 Bot en línea'))

// Menú personalizado usando helpText
bot.command('ayuda', (ctx) => ctx.reply(`Hola ${ctx.pushName}\n\n${bot.helpText(ctx)}`))
```

---

## Equivalencias con la API original

| wa-easy | API original |
|---|---|
| `createBot({...})` | `new Client({...}, {...baileysOptions})` |
| `ctx.reply(t)` | `client.reply(m.chat, t, m)` |
| `ctx.whisper(t)` | `client.reply(m.chat, t, m, { exclusive: true })` |
| `ctx.react(e)` | `client.sendReact(m.chat, e, m.key)` |
| `ctx.progress(t)` | `client.sendProgress(m.chat, t, m)` |
| `ctx.ai(t)` | `client.sendFromAI(m.chat, t, m)` |
| `ctx.verified(t, l)` | `client.sendMessageVerify(m.chat, t, l)` |
| `ctx.preview(t, o)` | `client.sendMessageModify(m.chat, t, m, {...})` |
| `ctx.fakeReply(t, l, o)` | `client.sendMessageModifyV2(m.chat, t, l, {...})` |
| `ctx.image / video(src, c)` | `client.sendFile(m.chat, src, 'image.jpg' / 'video.mp4', c, m)` |
| `ctx.document(src, f, c)` | `client.sendFile(..., { document: true })` |
| `ctx.voice(src)` | `client.sendFile(..., { ptt: true })` |
| `ctx.audio(src, { cover })` | `client.sendFile(..., { APIC: cover })` |
| `ctx.photoLive(src, c)` | `client.sendFile(..., { photo_live: true })` |
| `ctx.ptv(src)` | `client.sendPtv(m.chat, src)` |
| `ctx.sticker(src, { type })` | `client.sendSticker(m.chat, src, m, { meta / lock / premium })` |
| `ctx.album(items)` | `client.sendAlbumMessage(m.chat, items, m)` |
| `ctx.poll(q, opts)` | `client.sendPoll(m.chat, q, { options, multiselect })` |
| `ctx.pollResult(n, v)` | `client.pollResult(m.chat, { name, votes }, m)` |
| `ctx.contact(c, o)` | `client.sendContact(m.chat, [c], m, o)` |
| `ctx.buttons(t, b, o)` | `client.replyButton(m.chat, b, m, { text, footer, ... })` |
| `ctx.interactive(c, b, o)` | `client.sendIAMessage(m.chat, b, m, { content, ... })` |
| `ctx.carousel(cards, o)` | `client.sendCarousel(m.chat, cards, m, o)` |
| `ctx.meta(blocks, o)` | `client.sendMetaMsg(m.chat, blocks, m, o)` |
| `ctx.forward(jid)` | `client.copyNForward(jid, m)` |
| `ctx.groupStatus(c, o)` | `client.groupStatus(m.chat, c, o)` |

Si necesitas algo que el wrapper no cubre, usa `ctx.sock` (el socket original) y `ctx.m` (el mensaje original).

---

## Notas y solución de problemas

- **Este wrapper se escribió a partir del README de `@neoxr/wb`, sin ejecutarlo contra la librería real.** Prueba cada función que vayas a usar; si alguna firma cambió en tu versión, el ajuste está en `index.js` (cada método de `Context` es una sola línea que llama a `ctx.sock`).
- **Solo ESM.** Si ves `Cannot use import statement outside a module`, añade `"type": "module"` a tu `package.json`.
- **Versión de WhatsApp Web.** El wrapper usa por defecto `version: [2, 3000, 1027023507]` (la del README original). Si la conexión falla, sobrescríbela: `createBot({ baileys: { version: [...] } })`.
- **`owners` y LIDs.** WhatsApp está migrando a identificadores LID; si `ctx.isOwner` no funciona para ti, imprime `ctx.sender` y añade ese valor (solo dígitos) a `owners`, o usa el evento `lid-mapping`.
- **Mensajes interactivos (`interactive`, `carousel`, `buttons`, `meta`, `groupStatus`).** Son funciones no oficiales que WhatsApp puede cambiar o bloquear. Úsalas con una cuenta secundaria.
- **El bot no responde.** Revisa que `ignoreSelf` no esté descartando tus pruebas (si escribes desde el mismo número del bot, pon `ignoreSelf: false`) y que el prefijo coincida con `prefixes`.
- **Errores en listeners de `bot.on('message', ...)`.** Los errores dentro de ese listener *no* los captura el bot; usa `try/catch` o comandos/middlewares, que sí están protegidos.
- **Reiniciar la sesión.** Borra la carpeta `session` (o el nombre que pusiste en `session`) y vuelve a iniciar.
