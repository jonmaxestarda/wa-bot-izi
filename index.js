/**
 * wa-easy — wrapper simplificado sobre @neoxr/wb (Baileys)
 *
 * Objetivos:
 *  - Una sola función para crear el bot:      createBot({ ... })
 *  - Comandos en una línea:                   bot.command('ping', ctx => ctx.reply('pong'))
 *  - Contexto (ctx) con métodos cortos:       ctx.reply / ctx.image / ctx.poll / ctx.buttons ...
 *  - Builders para botones, carruseles y meta-mensajes: Btn, card, Meta
 *
 * Solo ESM (igual que @neoxr/wb v6+).
 */
import { EventEmitter } from 'node:events'
import * as baileys from 'baileys'
import { Client } from '@neoxr/wb'

/* -------------------------------------------------------------------------- */
/*  Utilidades                                                                */
/* -------------------------------------------------------------------------- */

const DEFAULT_PREFIXES = ['.', '#', '!', '/']

/** Eventos de @neoxr/wb que se reenvían tal cual (excepto "message" y "error"). */
const FORWARDED_EVENTS = [
   'connect', 'ready', 'stories', 'message.delete', 'message.receipt',
   'group.add', 'group.remove', 'group.promote', 'group.demote', 'group.request',
   'caller', 'poll', 'presence.update', 'lid-mapping'
]

const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
const toArray = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v])
const digits = (jid = '') => String(jid).split('@')[0].split(':')[0]
const json = (obj) => JSON.stringify(obj)

/* -------------------------------------------------------------------------- */
/*  Builders                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Botones nativos para ctx.interactive()
 * @example ctx.interactive('Hola', [Btn.reply('Owner', '.owner'), Btn.url('Web', 'https://...')])
 */
export const Btn = {
   /** Botón de respuesta rápida: envía `id` (normalmente un comando) al pulsarlo. */
   reply: (text, id) => ({ name: 'quick_reply', buttonParamsJson: json({ display_text: text, id }) }),
   /** Botón que abre una URL. */
   url: (text, url) => ({ name: 'cta_url', buttonParamsJson: json({ display_text: text, url, merchant_url: url }) }),
   /** Botón que copia un texto al portapapeles. */
   copy: (text, code) => ({ name: 'cta_copy', buttonParamsJson: json({ display_text: text, copy_code: code }) }),
   /** Botón que llama a un número. */
   call: (text, phone) => ({ name: 'cta_call', buttonParamsJson: json({ display_text: text, phone_number: String(phone) }) }),
   /**
    * Lista desplegable.
    * rows: [{ title, description?, command | id }]
    */
   list: (title, rows) => ({
      name: 'single_select',
      buttonParamsJson: json({
         title,
         sections: [{
            rows: rows.map((r) => ({ title: r.title, description: r.description ?? '', id: r.id ?? r.command }))
         }]
      })
   })
}

/**
 * Tarjeta para ctx.carousel()
 * @example card({ image: url, text: 'Producto', buttons: [Btn.url('Ver', 'https://...')] })
 */
export const card = ({ image, text = '', buttons = [] }) => ({
   header: { imageMessage: image, hasMediaAttachment: true },
   body: { text },
   nativeFlowMessage: { buttons }
})

/**
 * Bloques para ctx.meta() (mensajes "rich").
 * @example ctx.meta([Meta.text('Hola'), Meta.code('console.log(1)'), Meta.table(['A','B'], [[1,2]])])
 */
export const Meta = {
   text: (text) => ({ text }),
   code: (code, language = 'javascript') => ({ code: { language, code } }),
   table: (headers, rows, title) => ({ table: clean({ title, headers, rows }) }),
   muted: (text) => ({ muted: text }),
   suggestions: (...items) => ({ suggestions: items.flat() }),
   /** items: [{ icon, title, url }] */
   sources: (items) => ({ sources: toArray(items) }),
   /** items: [{ creator, avatar, verified, thumbnail, url, source }] */
   reels: (items) => ({ reels: toArray(items) }),
   /** items: [{ username, avatar, verified, caption, url, thumbnail, source, post_type }] */
   posts: (items) => ({ posts: toArray(items) }),
   /** Un objeto = producto simple, array = slide. { title, image, price?, sale_price, brand, url } */
   products: (items) => ({ products: items })
}

/* -------------------------------------------------------------------------- */
/*  Context                                                                   */
/* -------------------------------------------------------------------------- */

export class Context {
   constructor(bot, raw) {
      const m = raw.m
      this.bot = bot
      this.raw = raw
      this.m = m

      // Datos del mensaje
      this.id = m.id
      this.chat = m.chat
      this.sender = m.sender
      this.number = digits(m.sender)
      this.tag = `@${this.number}`
      this.pushName = m.pushName || ''
      this.type = m.mtype
      this.isGroup = Boolean(m.isGroup)
      this.fromMe = Boolean(m.fromMe)
      this.quoted = m.quoted ?? null
      this.mentions = m.mentionedJid ?? []
      this.body = raw.body ?? m.text ?? ''
      this.isOwner = this.fromMe || bot.options.owners.includes(this.number)

      // Se rellenan al parsear
      this.prefix = null
      this.command = ''
      this.args = []
      this.text = ''
      this.match = null // resultado de RegExp en bot.hears()
   }

   /** Socket de Baileys extendido por @neoxr/wb (acceso total a la API original). */
   get sock() { return this.bot.sock }

   /* ------------------------------- Texto -------------------------------- */

   /** Responde citando el mensaje. */
   reply(text, opts) { return this.sock.reply(this.chat, text, this.m, opts) }

   /** Responde en un grupo, pero solo lo ve quien escribió (exclusive). */
   whisper(text) { return this.reply(text, { exclusive: true }) }

   /** Reacciona al mensaje con un emoji. */
   react(emoji = '👍') { return this.sock.sendReact(this.chat, emoji, this.m.key) }

   /** Texto con barra de progreso. */
   progress(text) { return this.sock.sendProgress(this.chat, text, this.m) }

   /** Texto con la etiqueta "AI" (solo WhatsApp Business). */
   ai(text) { return this.sock.sendFromAI(this.chat, text, this.m) }

   /** Texto con "fake quoted" verificado. */
   verified(text, label = this.bot.options.name) { return this.sock.sendMessageVerify(this.chat, text, label) }

   /**
    * Texto con miniatura / preview personalizado.
    * @param {object} o { title, thumbnail, url, large=true, ads=false, link=false, ratio, icon }
    *   - link:true usa el modo "preview-link" (ratio: landscape | portrait | square)
    */
   preview(text, { title, thumbnail, url, large = true, ads = false, link = false, ratio, icon } = {}) {
      return this.sock.sendMessageModify(this.chat, text, this.m, clean({
         title: title ?? this.bot.options.name,
         largeThumb: large,
         ads: link ? undefined : ads,
         thumbnail,
         url,
         type: link ? 'preview-link' : undefined,
         ratio,
         icon
      }))
   }

   /** Igual que preview() pero con un "fake quoted" con la etiqueta indicada. */
   fakeReply(text, label = this.bot.options.name, { title, thumbnail, url, large = true, ads = false } = {}) {
      return this.sock.sendMessageModifyV2(this.chat, text, label, clean({
         title: title ?? label, largeThumb: large, ads, thumbnail, url
      }))
   }

   /* ------------------------------ Archivos ------------------------------ */

   /** Envía cualquier archivo (ruta, URL o Buffer). La extensión se detecta sola. */
   file(src, filename = '', caption = '', opts) {
      return this.sock.sendFile(this.chat, src, filename, caption, this.m, opts)
   }
   image(src, caption = '') { return this.file(src, 'image.jpg', caption) }
   video(src, caption = '') { return this.file(src, 'video.mp4', caption) }
   /** Audio normal. `cover` = Buffer para la carátula (APIC). */
   audio(src, { cover } = {}) { return this.file(src, '', '', cover ? { APIC: cover } : undefined) }
   /** Nota de voz. */
   voice(src) { return this.file(src, '', '', { ptt: true }) }
   /** Como documento. */
   document(src, filename = 'file', caption = '') { return this.file(src, filename, caption, { document: true }) }
   /** Video como "photo live". `thumbnail` opcional (Buffer | URL | ruta). */
   photoLive(src, caption = '', { thumbnail } = {}) {
      return this.file(src, 'video.mp4', caption, clean({ photo_live: true, thumbnail }))
   }
   /** Video circular (PTV, máx. 10 s). */
   ptv(src) { return this.sock.sendPtv(this.chat, src) }

   /**
    * Sticker desde URL o Buffer.
    * @param {object} o { packname, author, type: 'normal' | 'meta' | 'lock' | 'premium' }
    */
   sticker(src, { packname, author, type = 'normal' } = {}) {
      return this.sock.sendSticker(this.chat, src, this.m, clean({
         packname: packname ?? this.bot.options.packname,
         author: author ?? this.bot.options.author,
         meta: type === 'meta' || undefined,
         lock: type === 'lock' || undefined,
         premium: type === 'premium' || undefined
      }))
   }

   /** Varias imágenes/videos en un álbum. items: string | { url, caption?, type? } */
   album(items) {
      return this.sock.sendAlbumMessage(
         this.chat,
         items.map((i) => (typeof i === 'string' ? { url: i } : i)),
         this.m
      )
   }

   /* ----------------------------- Interactivos ---------------------------- */

   /**
    * Encuesta.
    * @param {string} question
    * @param {Array<string|{name:string,image:string}>} options
    * @param {object} o { multiselect=false }
    */
   poll(question, options, { multiselect = false } = {}) {
      const withImages = options.some((o) => typeof o === 'object')
      const payload = { options, multiselect }
      return withImages
         ? this.sock.sendPoll(this.chat, question, payload, this.m)
         : this.sock.sendPoll(this.chat, question, payload)
   }

   /**
    * Resultado de encuesta.
    * @param {string} name
    * @param {Array<{name,count}>|Record<string,number>} votes
    */
   pollResult(name, votes) {
      const list = Array.isArray(votes) ? votes : Object.entries(votes).map(([n, count]) => ({ name: n, count }))
      return this.sock.pollResult(this.chat, { name, votes: list }, this.m)
   }

   /** Contacto(s). contacts: { name, number, about? } o array de ellos. */
   contact(contacts, { org, website, email } = {}) {
      return this.sock.sendContact(this.chat, toArray(contacts), this.m, clean({ org, website, email }))
   }

   /**
    * Botones clásicos (texto + comando).
    * @param {string} text   No puede estar vacío. Admite "@0" para mencionar.
    * @param {Array<{text,command}>} buttons
    * @param {object} o { footer, media, document: {filename}, location: {name, description} }
    */
   buttons(text, buttons, { footer, media, document, location } = {}) {
      return this.sock.replyButton(this.chat, buttons, this.m, clean({
         text,
         footer: footer ?? this.bot.options.footer,
         media,
         document,
         location
      }))
   }

   /**
    * Mensaje interactivo (botones nativos / lista). Usa los builders `Btn`.
    * @param {string} content
    * @param {Array} buttons  Btn.reply / Btn.url / Btn.copy / Btn.call / Btn.list
    * @param {object} o { header, footer, media, v2, multiple: { name, code, list_title, button_title } }
    */
   interactive(content, buttons, { header = '', footer, media, v2, multiple } = {}) {
      return this.sock.sendIAMessage(this.chat, buttons, this.m, clean({
         header,
         content,
         footer: footer ?? '',
         media,
         v2,
         multiple
      }))
   }

   /** Carrusel. cards: array de card({ image, text, buttons }). */
   carousel(cards, { content = '' } = {}) {
      return this.sock.sendCarousel(this.chat, cards, this.m, { content })
   }

   /**
    * Mensaje "rich" (texto, código, tablas, reels, posts, productos...). Usa `Meta`.
    * Los strings sueltos se convierten en { text }.
    */
   meta(blocks, { title, mentions } = {}) {
      const list = toArray(blocks).map((b) => (typeof b === 'string' ? { text: b } : b))
      return this.sock.sendMetaMsg(this.chat, list, this.m, clean({
         title: title ?? this.bot.options.name,
         mentions
      }))
   }

   /* ------------------------------- Otros -------------------------------- */

   /** Reenvía el mensaje actual (por defecto al mismo chat). */
   forward(to = this.chat) { return this.sock.copyNForward(to, this.m) }

   /**
    * Estado de grupo (video, imagen, audio o texto).
    * @param {string|object} content  string => texto; objeto => { media, caption } | { media, background } | { text, background, color } | quoted.fakeObj
    * @param {object} o { private: { name, emoji } }  (amigos cercanos)
    */
   groupStatus(content, opts) {
      const payload = typeof content === 'string' ? { text: content } : content
      return opts
         ? this.sock.groupStatus(this.chat, payload, opts)
         : this.sock.groupStatus(this.chat, payload)
   }
}

/* -------------------------------------------------------------------------- */
/*  Bot                                                                       */
/* -------------------------------------------------------------------------- */

const DEFAULT_MESSAGES = {
   owner: '⚠️ Este comando es solo para el owner.',
   group: '⚠️ Este comando solo funciona en grupos.',
   private: '⚠️ Este comando solo funciona en chat privado.',
   cooldown: (s) => `⏳ Espera ${s}s antes de usar este comando de nuevo.`,
   error: '❌ Ocurrió un error ejecutando el comando.'
}

export class Bot extends EventEmitter {
   /**
    * @param {object} options Ver README (sección "Opciones").
    */
   constructor(options = {}) {
      super()
      const name = options.name ?? 'Bot'
      this.options = {
         id: 'bot',
         name,
         footer: options.footer ?? name,
         prefixes: DEFAULT_PREFIXES,
         noPrefix: false,
         owners: [],
         ignoreSelf: true,
         ignoreBots: true,
         replyOnError: true,
         help: true,
         packname: 'Sticker by',
         author: '',
         presence: true,
         online: true,
         bypassDisappearing: true,
         store: 'local',
         session: 'session',
         debug: false,
         isBot: (id) => (id.startsWith('3EB0') && id.length === 40) || id.startsWith('BAE') || /[-]/.test(id),
         ...options
      }
      this.options.owners = toArray(this.options.owners).map(digits)
      this.options.messages = { ...DEFAULT_MESSAGES, ...(options.messages ?? {}) }

      this.lib = null
      this.commands = new Map() // nombre -> definición
      this.aliases = new Map() // alias -> nombre
      this._hears = []
      this._middlewares = []
      this._cooldowns = new Map()

      if (this.options.help) this._registerHelp()
   }

   /** Socket de Baileys (disponible tras start()). */
   get sock() { return this.lib?.sock }

   /* ------------------------------ Registro ------------------------------ */

   /**
    * Registra un comando.
    * @param {string|string[]} names  Nombre o [nombre, ...alias]
    * @param {(ctx: Context) => any} handler
    * @param {object} [meta] { aliases, description, usage, category='general', owner, group, private, cooldown (seg), hidden }
    */
   command(names, handler, meta = {}) {
      const list = toArray(names).map((n) => String(n).toLowerCase())
      const def = {
         category: 'general',
         ...meta,
         name: list[0],
         aliases: [...list.slice(1), ...toArray(meta.aliases).map((a) => String(a).toLowerCase())],
         handler
      }
      this.commands.set(def.name, def)
      def.aliases.forEach((a) => this.aliases.set(a, def.name))
      return this
   }

   /**
    * Reacciona a mensajes sin prefijo.
    * @param {string|RegExp|Function} pattern string => contiene (sin mayúsculas), RegExp => test, función => predicado
    * @param {(ctx: Context) => any} handler  ctx.match contiene el resultado de la RegExp
    */
   hears(pattern, handler) {
      this._hears.push({ pattern, handler })
      return this
   }

   /** Middleware: async (ctx, next) => { ...; await next() } */
   use(fn) {
      this._middlewares.push(fn)
      return this
   }

   /* ------------------------------ Ciclo de vida -------------------------- */

   /** Crea la conexión y empieza a escuchar mensajes. */
   start() {
      if (this.lib) return this
      const o = this.options

      const pairing = o.number
         ? clean({ state: true, number: String(o.number), code: o.pairingCode })
         : { state: false, number: '' } // QR

      const libOptions = clean({
         plugsdir: o.plugins,
         presence: o.presence,
         online: o.online,
         bypass_disappearing: o.bypassDisappearing,
         stealth: o.stealth,
         pairing,
         create_session: {
            type: o.store,
            session: o.session,
            config: o.databaseUrl ?? process.env?.DATABASE_URL ?? ''
         },
         custom_id: o.id,
         bot: o.isBot,
         setting: o.setting,
         engines: [baileys],
         debug: o.debug
      })

      const baileysOptions = {
         version: [2, 3000, 1027023507],
         browser: ['Ubuntu', 'Firefox', '20.0.00'],
         shouldIgnoreJid: (jid) => /(newsletter|bot)/.test(jid),
         ...(o.baileys ?? {})
      }

      this.lib = new Client(libOptions, baileysOptions)

      this.lib.on('message', (raw) => this._handle(raw))
      this.lib.on('error', (err) => this._emitError(err))
      for (const ev of FORWARDED_EVENTS) this.lib.on(ev, (...args) => this.emit(ev, ...args))

      return this
   }

   /* ------------------------------- Helpers ------------------------------- */

   /** Envía texto a cualquier JID (sin necesidad de un mensaje previo). */
   sendText(jid, text, extra = {}) { return this.sock.sendMessage(jid, { text, ...extra }) }

   /** Texto del menú de ayuda, agrupado por categoría. */
   helpText(ctx) {
      const prefix = ctx?.prefix ?? this.options.prefixes[0]
      const groups = new Map()
      for (const def of this.commands.values()) {
         if (def.hidden || (def.owner && !ctx?.isOwner)) continue
         if (!groups.has(def.category)) groups.set(def.category, [])
         groups.get(def.category).push(def)
      }
      let out = `*${this.options.name}*\n`
      for (const [cat, defs] of groups) {
         out += `\n*${cat.toUpperCase()}*\n`
         for (const d of defs) {
            out += `• ${prefix}${d.name}${d.usage ? ' ' + d.usage : ''}${d.description ? ' — ' + d.description : ''}\n`
         }
      }
      return out.trim()
   }

   /* ------------------------------- Internos ------------------------------ */

   _registerHelp() {
      const name = typeof this.options.help === 'object' ? this.options.help.command ?? 'menu' : 'menu'
      this.command([name, 'help'], (ctx) => ctx.reply(this.helpText(ctx)), {
         description: 'Muestra los comandos disponibles'
      })
   }

   _parse(ctx) {
      const body = (ctx.body || '').trim()
      if (!body) return
      const prefix = this.options.prefixes.find((p) => body.startsWith(p))
      let rest
      if (prefix !== undefined) rest = body.slice(prefix.length)
      else if (this.options.noPrefix) rest = body
      else return

      const match = rest.trim().match(/^(\S+)\s*([\s\S]*)$/)
      if (!match) return
      ctx.prefix = prefix ?? ''
      ctx.command = match[1].toLowerCase()
      ctx.text = match[2]
      ctx.args = ctx.text ? ctx.text.split(/\s+/) : []
   }

   async _handle(raw) {
      const m = raw?.m
      if (!m) return
      if (this.options.ignoreSelf && m.fromMe) return
      if (this.options.ignoreBots && m.isBot) return

      const ctx = new Context(this, raw)
      this._parse(ctx)
      this.emit('message', ctx)

      try {
         const stack = [...this._middlewares, (c) => this._dispatch(c)]
         const run = async (i) => { if (stack[i]) await stack[i](ctx, () => run(i + 1)) }
         await run(0)
      } catch (err) {
         await this._fail(ctx, err)
      }
   }

   async _dispatch(ctx) {
      // 1) Comandos
      if (ctx.command) {
         const def = this.commands.get(ctx.command) ?? this.commands.get(this.aliases.get(ctx.command))
         if (def) {
            const msg = this.options.messages
            if (def.owner && !ctx.isOwner) return ctx.reply(msg.owner)
            if (def.group && !ctx.isGroup) return ctx.reply(msg.group)
            if (def.private && ctx.isGroup) return ctx.reply(msg.private)

            if (def.cooldown && !ctx.isOwner) {
               const key = `${def.name}:${ctx.sender}`
               const last = this._cooldowns.get(key) ?? 0
               const left = Math.ceil((last + def.cooldown * 1000 - Date.now()) / 1000)
               if (left > 0) return ctx.reply(msg.cooldown(left))
               this._cooldowns.set(key, Date.now())
            }
            return def.handler(ctx)
         }
         this.emit('command.unknown', ctx)
      }

      // 2) Frases sin prefijo
      const text = ctx.body || ''
      if (!text) return
      for (const h of this._hears) {
         const { pattern } = h
         let hit = false
         if (pattern instanceof RegExp) {
            ctx.match = text.match(pattern)
            hit = Boolean(ctx.match)
         } else if (typeof pattern === 'function') {
            hit = Boolean(pattern(ctx))
         } else {
            hit = text.toLowerCase().includes(String(pattern).toLowerCase())
         }
         if (hit) return h.handler(ctx)
      }
   }

   async _fail(ctx, err) {
      this._emitError(err, ctx)
      if (this.options.replyOnError) {
         try { await ctx.reply(this.options.messages.error) } catch { /* ignorar */ }
      }
   }

   _emitError(err, ctx) {
      if (this.listenerCount('error') > 0) this.emit('error', err, ctx)
      else console.error('[wa-easy]', err)
   }
}

/** Atajo: createBot(opts) === new Bot(opts) */
export const createBot = (options) => new Bot(options)

export default createBot
