// Runs one match against the bot: turn timer, bot lock-in, and playing back each engine "beat"
// with animations. It lives outside React; the UI subscribes to `getView()`.
import {
  BOARD_SIZE, DECISION_SECONDS, TURN_SECONDS, createGame, other, resolveTurn,
  type Beat, type Choices, type DecisionRequest, type DecisionYield, type GameState, type Picks, type PlayerId,
} from '../engine'
import { botDecide, chooseBotPicks } from '../bot/bot'
import type { Decision, Fx, MatchView, Popup, UnitVis } from './types'

const DISPOSED = Symbol('disposed')

const freshUnit = (tile: number): UnitVis => ({
  tile, pose: 'idle', lift: 0, liftMs: 300, liftEase: 'out', moveMs: 400, hurt: 0, swap: 0, guard: false, ko: false, gone: false, cheer: false,
})

export class MatchController {
  private view: MatchView
  private game: GameState
  private listeners = new Set<() => void>()
  private disposed = false
  private nextId = 1
  private timers = new Set<ReturnType<typeof setTimeout>>()
  private cleanups = new Set<() => void>()
  private humanDecision: ((tile: number) => void) | null = null

  /** Test / debugging hooks (exposed on window only in dev builds). */
  dev: {
    foePicks?: Picks
    foeDecide?: (req: DecisionRequest) => number
    botLockMs?: [number, number]
    turnSeconds?: number
    decisionSeconds?: number
  } = {}

  constructor(seed = (Math.random() * 2 ** 32) >>> 0) {
    this.game = createGame(seed)
    this.view = {
      phase: 'intro',
      game: this.game,
      timeLeft: TURN_SECONDS,
      picks: [null, null],
      locked: false,
      foeLocked: false,
      spent: [[], []],
      fresh: [[], []],
      center: [null, null],
      units: [freshUnit(this.game.players[0].tile), freshUnit(this.game.players[1].tile)],
      fx: [],
      popups: [],
      decision: null,
      banner: null,
      hint: '',
      slot: null,
      winner: null,
    }
  }

  // ---------- React bridge ----------
  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  getView = () => this.view
  private set(patch: Partial<MatchView>) {
    this.view = { ...this.view, ...patch }
    this.listeners.forEach((l) => l())
  }
  private setUnit(p: PlayerId, patch: Partial<UnitVis>) {
    const units = [...this.view.units] as MatchView['units']
    units[p] = { ...units[p], ...patch }
    this.set({ units })
  }
  private bumpHurt(p: PlayerId) {
    this.setUnit(p, { hurt: this.view.units[p].hurt + 1 })
  }

  // ---------- lifecycle ----------
  start() {
    void this.run()
  }
  dispose() {
    this.disposed = true
    this.timers.forEach(clearTimeout)
    this.cleanups.forEach((c) => c())
    this.listeners.clear()
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        this.timers.delete(t)
        this.disposed ? reject(DISPOSED) : resolve()
      }, ms)
      this.timers.add(t)
    })
  }

  private async run() {
    try {
      this.set({ phase: 'intro', banner: 'FIGHT!' })
      await this.wait(1100)
      this.set({ banner: null })
      while (this.game.winner == null) { // note: winner can be 0, which is falsy
        const picks = await this.planning()
        await this.resolving(picks)
      }
      await this.wait(1500)
      this.set({ phase: 'over', banner: null })
    } catch (e) {
      if (e !== DISPOSED) throw e
    }
  }

  // ---------- planning (30 s) ----------
  /** The human picks up to two hand cards; the bot thinks and locks in at a random moment. */
  selectCard(index: number) {
    const v = this.view
    if (v.phase !== 'planning' || v.locked) return
    let [a, b] = v.picks
    if (a === index) { a = b; b = null }
    else if (b === index) b = null
    else if (a == null) a = index
    else if (b == null) b = index
    else return
    const locked = a != null && b != null
    this.set({ picks: [a, b], locked, hint: locked ? 'Locked in. Waiting for the opponent…' : a == null ? 'Pick your 1st action' : 'Pick your 2nd action' })
  }

  /** Dev only: edit the displayed + real game state in place (hands, tiles, hp). */
  debugPatch(fn: (g: GameState) => void) {
    const g = structuredClone(this.game)
    fn(g)
    this.game = g
    const units = this.view.units.map((u, p) => ({ ...u, tile: g.players[p].tile })) as MatchView['units']
    this.set({ game: g, units })
  }

  private planning(): Promise<[Picks, Picks]> {
    return new Promise((resolve, reject) => {
      const turnSeconds = this.dev.turnSeconds ?? TURN_SECONDS
      const deadline = Date.now() + turnSeconds * 1000
      const [lo, hi] = this.dev.botLockMs ?? [1500, 7500]
      const botLockAt = Date.now() + lo + Math.random() * (hi - lo)
      let botPicks: Picks | null = null
      this.set({
        phase: 'planning', picks: [null, null], locked: false, foeLocked: false, timeLeft: turnSeconds,
        spent: [[], []], center: [null, null], slot: null, hint: 'Pick your 1st action',
      })
      const thinkTimer = setTimeout(() => { botPicks = this.dev.foePicks ?? chooseBotPicks(this.game, 1) }, 80)
      const tick = setInterval(() => {
        if (this.disposed) { cleanup(); reject(DISPOSED); return }
        const now = Date.now()
        const left = Math.max(0, Math.ceil((deadline - now) / 1000))
        const foeLocked = botPicks != null && now >= botLockAt
        if (left !== this.view.timeLeft || foeLocked !== this.view.foeLocked) this.set({ timeLeft: left, foeLocked })
        if ((this.view.locked && foeLocked) || now >= deadline) {
          cleanup()
          botPicks ??= this.dev.foePicks ?? chooseBotPicks(this.game, 1)
          this.set({ locked: true, foeLocked: true, hint: '' })
          // short beat so the "both ready" state is readable
          this.wait(350).then(() => resolve([this.view.picks, botPicks!]), reject)
        }
      }, 100)
      const cleanup = () => { clearInterval(tick); clearTimeout(thinkTimer); this.cleanups.delete(cleanup) }
      this.cleanups.add(cleanup)
    })
  }

  // ---------- resolving ----------
  private async resolving(picks: [Picks, Picks]) {
    this.set({ phase: 'resolving', hint: '' })
    const gen = resolveTurn(this.game, picks)
    let r = gen.next()
    while (!r.done) {
      const y = r.value
      if (y.type === 'decision') {
        const choices = await this.decide(y)
        r = gen.next(choices)
      } else {
        await this.playBeat(y, picks)
        r = gen.next()
      }
    }
  }

  chooseTile(tile: number) {
    if (this.humanDecision && this.view.decision?.options.includes(tile)) this.humanDecision(tile)
  }

  private async decide(y: DecisionYield): Promise<Choices> {
    const choices: Choices = {}
    let mine: DecisionRequest | null = null
    for (const req of y.requests) {
      if (req.player === 1) choices[1] = this.dev.foeDecide ? this.dev.foeDecide(req) : botDecide(req, y.state)
      else mine = req
    }
    if (!mine) {
      await this.wait(200)
    } else if (mine.options.length <= 1) {
      choices[0] = mine.default
    } else {
      choices[0] = await this.askHuman(mine)
    }
    return choices
  }

  private askHuman(req: DecisionRequest): Promise<number> {
    return new Promise((resolve, reject) => {
      const seconds = this.dev.decisionSeconds ?? DECISION_SECONDS
      const deadline = Date.now() + seconds * 1000
      const decision: Decision = { kind: req.kind, options: req.options, secondsLeft: seconds }
      this.set({
        decision, timeLeft: seconds,
        hint: req.kind === 'step' ? 'Choose where to step' : 'Choose where to throw them',
      })
      const finish = (tile: number) => {
        clearInterval(tick)
        this.cleanups.delete(abort)
        this.humanDecision = null
        this.set({ decision: null, hint: '' })
        resolve(tile)
      }
      const abort = () => { clearInterval(tick); reject(DISPOSED) }
      this.cleanups.add(abort)
      this.humanDecision = finish
      const tick = setInterval(() => {
        const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
        if (left !== this.view.timeLeft) this.set({ timeLeft: left, decision: { ...decision, secondsLeft: left } })
        if (Date.now() >= deadline) finish(req.default)
      }, 100)
    })
  }

  // ---------- visuals ----------
  private fx(f: Omit<Fx, 'id'>) {
    const fx = { ...f, id: this.nextId++ }
    this.set({ fx: [...this.view.fx, fx] })
    const t = setTimeout(() => {
      this.timers.delete(t)
      this.set({ fx: this.view.fx.filter((x) => x.id !== fx.id) })
    }, f.ms + 80)
    this.timers.add(t)
  }
  private popup(p: Omit<Popup, 'id'>) {
    const pop = { ...p, id: this.nextId++ }
    this.set({ popups: [...this.view.popups, pop] })
    const t = setTimeout(() => {
      this.timers.delete(t)
      this.set({ popups: this.view.popups.filter((x) => x.id !== pop.id) })
    }, 1300)
    this.timers.add(t)
  }
  private tileOf = (p: PlayerId) => this.view.units[p].tile
  private show(state: GameState) {
    this.game = state
    this.set({ game: state })
  }

  private async playBeat(b: Beat, picks: [Picks, Picks]) {
    switch (b.type) {
      case 'slotStart': {
        const key = this.nextId++
        const idx = [picks[0][b.slot], picks[1][b.slot]]
        const center = [0, 1].map((p) => {
          const type = b.cards[p as PlayerId]
          return type ? { type, key: key + p, fromIndex: idx[p]! } : null
        }) as MatchView['center']
        const spent = this.view.spent.map((s, p) => (idx[p] != null ? [...s, idx[p]!] : s)) as MatchView['spent']
        this.set({ slot: b.slot, center, spent, hint: `Action ${b.slot + 1} of 2` })
        await this.wait(center[0] || center[1] ? 1000 : 350)
        break
      }
      case 'change': {
        for (const c of b.changes) {
          this.setUnit(c.player, { swap: this.view.units[c.player].swap + 1 })
          this.fx({ kind: 'pop', icon: 'change', tile: this.tileOf(c.player), ms: 800, y: 268, size: 74 })
        }
        await this.wait(350)
        this.show(b.state)
        await this.wait(350)
        break
      }
      case 'step': {
        const clash = b.clashTile != null
        for (const m of b.moves) {
          this.setUnit(m.player, { pose: 'step', moveMs: 0 })
          this.fx({ kind: 'dust', tile: m.from, ms: 500 })
        }
        await this.wait(150)
        if (clash) {
          for (const m of b.moves) this.setUnit(m.player, { tile: (m.from + b.clashTile!) / 2, moveMs: 260 })
          await this.wait(270)
          this.fx({ kind: 'burst', tile: b.clashTile!, ms: 500, y: 80, size: 120 })
          this.popup({ tile: b.clashTile!, text: 'CLASH!', tone: 'info', y: 200 })
          for (const m of b.moves) this.bumpHurt(m.player)
          await this.wait(350)
          for (const m of b.moves) this.setUnit(m.player, { tile: m.from, moveMs: 320 })
          await this.wait(340)
        } else {
          for (const m of b.moves) {
            const d = Math.abs(m.to - m.from)
            if (d === 0) this.setUnit(m.player, { lift: 18, liftMs: 140, liftEase: 'out' })
            else this.setUnit(m.player, { tile: m.to, moveMs: 200 + 160 * d })
          }
          await this.wait(Math.max(...b.moves.map((m) => 200 + 160 * Math.abs(m.to - m.from))) + 30)
          for (const m of b.moves) {
            this.setUnit(m.player, { lift: 0, liftMs: 120, liftEase: 'in' })
            if (m.to !== m.from) this.fx({ kind: 'dust', tile: m.to, ms: 450 })
          }
          await this.wait(150)
        }
        for (const m of b.moves) this.setUnit(m.player, { pose: this.view.units[m.player].guard ? 'block' : 'idle' })
        this.show(b.state)
        await this.wait(120)
        break
      }
      case 'guard': {
        for (const p of b.players) {
          this.setUnit(p, { pose: 'block', guard: true })
          this.fx({ kind: 'pop', icon: 'block', tile: this.tileOf(p), ms: 800, y: 268, size: 74 })
        }
        await this.wait(550)
        break
      }
      case 'grab': {
        const home = b.grabs.map((g) => ({ p: g.player, tile: this.tileOf(g.player) }))
        for (const g of b.grabs) {
          const dir = Math.sign(this.tileOf(other(g.player)) - this.tileOf(g.player))
          this.setUnit(g.player, { pose: 'grab', moveMs: 170, tile: this.tileOf(g.player) + dir * 0.55 })
        }
        await this.wait(220)
        const mid = (this.tileOf(0) + this.tileOf(1)) / 2
        this.fx({ kind: 'pop', icon: 'grab', tile: mid, ms: 650, y: 110, size: 84 })
        if (b.clash) {
          this.fx({ kind: 'burst', tile: mid, ms: 500, y: 90, size: 120 })
          this.popup({ tile: mid, text: 'GRAB CLASH!', tone: 'info', y: 210 })
        } else {
          this.show(b.state)
          for (const g of b.grabs) {
            const foe = other(g.player)
            if (g.hit) {
              this.bumpHurt(foe)
              this.popup({ tile: this.tileOf(foe), text: 'GRABBED!', tone: 'info', y: 230 })
            } else {
              this.popup({ tile: this.tileOf(foe), text: 'MISS', tone: 'info', y: 200 })
            }
          }
        }
        await this.wait(650)
        const anyHit = b.grabs.some((g) => g.hit)
        for (const h of home) this.setUnit(h.p, { tile: h.tile, moveMs: 200, pose: 'idle' })
        await this.wait(anyHit ? 120 : 260)
        break
      }
      case 'throw': {
        const to = b.to
        if (b.ringOut) {
          // sail over the cliff, tumble and drop out of the picture
          this.setUnit(b.target, { pose: 'idle', lift: 230, liftMs: 330, liftEase: 'out', tile: to, moveMs: 720, ko: true })
          this.popup({ tile: this.tileOf(b.thrower), text: 'THROW!', tone: 'info', y: 215 })
          await this.wait(330)
          this.setUnit(b.target, { lift: -560, liftMs: 650, liftEase: 'in' })
          await this.wait(420)
          this.popup({ tile: to + (to < 1 ? 1 : -1) * 0.55, text: 'RING OUT!', tone: 'dmg', y: 150 })
          await this.wait(330)
          this.setUnit(b.target, { gone: true, ko: false, lift: 0, liftMs: 0 })
          this.show(b.state) // the unit pip crosses out
          await this.wait(450)
          break
        }
        this.setUnit(b.target, { pose: 'idle', lift: 190, liftMs: 330, liftEase: 'out', tile: to, moveMs: 660 })
        this.popup({ tile: this.tileOf(b.thrower), text: 'THROW!', tone: 'info', y: 215 })
        await this.wait(330)
        this.setUnit(b.target, { lift: 0, liftMs: 330, liftEase: 'in' })
        await this.wait(330)
        this.fx({ kind: 'dust', tile: to, ms: 500 })
        this.bumpHurt(b.target)
        this.show(b.state) // HP drops now, when the fall hits the ground
        if (b.damage > 0) this.popup({ tile: to, text: `-${b.damage}`, tone: 'dmg', y: 235 })
        await this.wait(350)
        break
      }
      case 'strike': {
        const attacks = b.results.filter((r) => r.kind === 'attack')
        const specials = b.results.filter((r) => r.kind === 'special')
        for (const r of b.results) this.setUnit(r.player, { pose: r.kind === 'attack' ? 'attack' : 'special' })
        for (const r of specials) this.fx({ kind: 'sparkles', icon: 'special', tile: this.tileOf(r.player), ms: 900, y: 110, size: 120 })
        await this.wait(260)
        for (const r of attacks) {
          this.fx({ kind: 'fly', icon: 'attack', tile: this.tileOf(r.player), toTile: r.targetTile!, ms: 260, y: 120, size: 150 })
        }
        await this.wait(attacks.length ? 260 : 400)
        this.show(b.state)
        for (const r of attacks) {
          const foe = other(r.player)
          const at = this.tileOf(foe)
          if (r.outcome === 'hit' || r.outcome === 'broken') {
            this.bumpHurt(foe)
            this.fx({ kind: 'burst', tile: at, ms: 450, y: 110, size: 130 })
            this.popup({ tile: at, text: `-${r.damage}`, tone: 'dmg', y: 235 })
            if (r.outcome === 'broken') {
              this.popup({ tile: at, text: 'BLOCK BROKEN!', tone: 'block', y: 292 })
              this.setUnit(foe, { guard: false })
            }
          } else if (r.outcome === 'blocked') {
            this.fx({ kind: 'shake', icon: 'block', tile: at, ms: 600, y: 150, size: 84 })
            this.popup({ tile: at, text: 'BLOCKED', tone: 'block', y: 235 })
          } else if (r.targetTile != null && r.targetTile >= 1 && r.targetTile <= BOARD_SIZE) {
            this.popup({ tile: r.targetTile, text: 'MISS', tone: 'info', y: 80 })
          }
        }
        for (const r of specials) this.popup({ tile: this.tileOf(r.player), text: r.heal > 0 ? `+${r.heal}` : 'MAX', tone: 'heal', y: 235 })
        await this.wait(700)
        for (const r of b.results) this.setUnit(r.player, { pose: this.view.units[r.player].guard ? 'block' : 'idle' })
        break
      }
      case 'respawn': {
        // the next unit drops in from above onto its start tile
        const p = b.player
        this.show(b.state)
        this.setUnit(p, { gone: false, ko: false, pose: 'idle', guard: false, tile: b.tile, moveMs: 0, lift: 560, liftMs: 0, liftEase: 'in' })
        await this.wait(70)
        this.setUnit(p, { lift: 0, liftMs: 480, liftEase: 'in' })
        await this.wait(480)
        this.fx({ kind: 'dust', tile: b.tile, ms: 500 })
        this.setUnit(p, { swap: this.view.units[p].swap + 1 })
        this.popup({ tile: b.tile, text: `UNIT ${b.unit + 1}`, tone: 'info', y: 235 })
        await this.wait(600)
        break
      }
      case 'slotEnd': {
        for (const p of [0, 1] as PlayerId[]) this.setUnit(p, { pose: 'idle', guard: false })
        this.set({ center: [null, null] })
        await this.wait(250)
        break
      }
      case 'refill': {
        this.show(b.state)
        this.set({
          fresh: [b.refills[0].indexes, b.refills[1].indexes],
          spent: [[], []],
          slot: null,
        })
        await this.wait(750)
        this.set({ fresh: [[], []] })
        break
      }
      case 'gameOver': {
        this.show(b.state)
        const loser = b.winner === 'draw' ? null : other(b.winner)
        // a unit that fell off the stage is already gone; only an HP knock-out lies down
        if (loser != null && !b.state.players[loser].fallen.every(Boolean)) this.setUnit(loser, { ko: true, pose: 'idle' })
        if (b.winner !== 'draw') this.setUnit(b.winner, { cheer: true, pose: 'special' })
        this.set({ winner: b.winner, banner: 'K.O.!', hint: '' })
        await this.wait(1200)
        break
      }
    }
  }
}
