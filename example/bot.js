import { createBot, Btn, card, Meta } from '../index.js'

const bot = createBot({
   name: 'Mi Bot',
   owners: ['5215512345678'],      // tu número (sin + ni espacios)
   number: '5215512345678',        // número DEL BOT -> pairing code. Quita esta línea para usar QR
   session: 'session',
   prefixes: ['.', '!', '/'],
   packname: 'Sticker by',
   author: 'Mi Bot'
})

/* ------------------------------ Middleware -------------------------------- */
bot.use(async (ctx, next) => {
   if (ctx.command) console.log(`[${ctx.isGroup ? 'GRUPO' : 'PV'}] ${ctx.pushName}: ${ctx.prefix}${ctx.command} ${ctx.text}`)
   await next()
})

/* ------------------------------- Comandos --------------------------------- */
bot.command('ping', (ctx) => ctx.reply('🏓 Pong!'), {
   description: 'Prueba de velocidad'
})

bot.command('eco', (ctx) => {
   if (!ctx.text) return ctx.reply('Escribe algo. Ej: .eco hola')
   return ctx.reply(ctx.text)
}, { usage: '<texto>', description: 'Repite tu texto', cooldown: 5 })

bot.command('reaccion', async (ctx) => {
   await ctx.react('🔥')
   await ctx.reply('Listo, reaccioné a tu mensaje.')
}, { category: 'diversion' })

bot.command('secreto', (ctx) => ctx.whisper('Solo tú puedes ver esto 🤫'), {
   group: true, category: 'diversion', description: 'Mensaje que solo ve quien lo pide'
})

bot.command('foto', (ctx) => ctx.image('https://iili.io/HP3ODj2.jpg', 'Aquí tienes 📷'), {
   category: 'media'
})

bot.command('sticker', (ctx) => ctx.sticker('https://iili.io/HP3ODj2.jpg'), { category: 'media' })

bot.command('encuesta', (ctx) => ctx.poll('¿Te gusta esta librería?', ['Sí', 'No']), {
   category: 'interactivo'
})

bot.command('botones', (ctx) => ctx.buttons('Hola @0, elige una opción:', [
   { text: 'Ping', command: '.ping' },
   { text: 'Menú', command: '.menu' }
]), { category: 'interactivo' })

bot.command('nativo', (ctx) => ctx.interactive('Botones nativos', [
   Btn.reply('Ping', '.ping'),
   Btn.url('Documentación', 'https://github.com/neoxr/neoxr-bot'),
   Btn.copy('Copiar código', '123456'),
   Btn.list('Más opciones', [
      { title: 'Ping', description: 'Prueba', command: '.ping' },
      { title: 'Menú', description: 'Ayuda', command: '.menu' }
   ])
], { footer: 'Mi Bot' }), { category: 'interactivo' })

bot.command('carrusel', (ctx) => ctx.carousel([
   card({ image: 'https://iili.io/HP3ODj2.jpg', text: 'Tarjeta 1', buttons: [Btn.url('Abrir', 'https://example.com')] }),
   card({ image: 'https://iili.io/HP3ODj2.jpg', text: 'Tarjeta 2', buttons: [Btn.url('Abrir', 'https://example.com')] })
], { content: 'Mira este carrusel' }), { category: 'interactivo' })

bot.command('meta', (ctx) => ctx.meta([
   `Hola ${ctx.tag}, esto es un mensaje *rich*.`,
   Meta.code('console.log("hola")'),
   Meta.table(['Comando', 'Descripción'], [['.ping', 'Pong'], ['.menu', 'Ayuda']], 'Comandos'),
   Meta.muted('Texto atenuado'),
   Meta.suggestions('Ping', 'Menú')
], { mentions: [ctx.sender] }), { category: 'interactivo' })

bot.command('contacto', (ctx) => ctx.contact(
   { name: 'Soporte', number: '5215512345678', about: 'Dueño del bot' },
   { org: 'Mi Empresa', email: 'contacto@example.com' }
), { category: 'general' })

bot.command('reenviar', (ctx) => ctx.forward(), { owner: true, hidden: true })

/* Comando de solo owner */
bot.command('apagar', async (ctx) => {
   await ctx.reply('Apagando...')
   process.exit(0)
}, { owner: true, description: 'Apaga el bot' })

/* ------------------------------ Sin prefijo ------------------------------- */
bot.hears(/^(hola|buenas)\b/i, (ctx) => ctx.reply(`¡Hola ${ctx.pushName}! 👋 Escribe .menu para ver los comandos.`))

/* -------------------------------- Eventos --------------------------------- */
bot.on('connect', () => console.log('Conectando...'))
bot.on('ready', () => console.log('✅ Bot listo'))
bot.on('command.unknown', (ctx) => ctx.react('❓'))
bot.on('error', (err, ctx) => console.error('Error:', err?.message ?? err, ctx ? `(en ${ctx.command})` : ''))

bot.start()
