/* Timesheet Tracker landing — small vanilla JS, no dependencies. */

/* Analytics placeholder — intentionally off for now.
   When ready, load a privacy-friendly script here (no cookies) and call it from track().
   function track(name, props) {}
*/

(function () {
	'use strict';

	const doc = document.documentElement;
	doc.classList.add('js');
	// ?static renders final states without motion (screenshots); ?p=0..1 freezes the app windows at that point.
	const q = new URLSearchParams(location.search);
	const isStatic = q.has('static');
	if (isStatic) doc.classList.add('static');
	const reduced = isStatic || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	/* ---------- mobile menu ---------- */
	const header = document.querySelector('.site-header');
	const toggle = document.querySelector('.nav-toggle');
	const closeNav = () => {
		document.body.classList.remove('nav-open');
		toggle && toggle.setAttribute('aria-expanded', 'false');
	};
	if (toggle) {
		toggle.addEventListener('click', () => {
			const open = document.body.classList.toggle('nav-open');
			toggle.setAttribute('aria-expanded', String(open));
		});
		document.querySelectorAll('.nav-links a').forEach((a) => a.addEventListener('click', closeNav));
		document.addEventListener('keydown', (e) => e.key === 'Escape' && closeNav());
	}

	/* ---------- reveal on scroll ---------- */
	const revealEls = document.querySelectorAll('.reveal, [data-inview]');
	if ('IntersectionObserver' in window && !reduced) {
		const io = new IntersectionObserver(
			(entries) => {
				entries.forEach((en) => {
					if (en.isIntersecting) {
						en.target.classList.add('in');
						io.unobserve(en.target);
					}
				});
			},
			{rootMargin: '0px 0px -10% 0px', threshold: 0.12},
		);
		revealEls.forEach((el) => io.observe(el));
	} else {
		revealEls.forEach((el) => el.classList.add('in'));
	}

	/* ---------- footer year ---------- */
	document.querySelectorAll('[data-year]').forEach((el) => (el.textContent = String(new Date().getFullYear())));

	/* =====================================================================
	   H4 · Two-pane morph. One parameter p ∈ [0,1] drives the whole transition:
	   shared elements (ring, total, sentence, button) fly from the simple layout to the
	   details layout and crossfade; the rest enter/leave in a cascade.
	   Trimmed port of the design prototype (ai-timesheet/docs/design/hybrid/src/common.js).
	   ===================================================================== */
	const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
	const lerp = (a, b, t) => a + (b - a) * t;
	const seg = (p, a, d) => clamp((p - a) / d);
	const out3 = (t) => 1 - Math.pow(1 - t, 3);
	const inout = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
	// connected-animation curve: cubic-bezier(.6,0,.12,1.12) — decisive middle, small overshoot
	const spring = (t) => {
		if (t <= 0) return 0;
		if (t >= 1) return 1;
		const B = (a, b, u) => 3 * a * (1 - u) * (1 - u) * u + 3 * b * (1 - u) * u * u + u * u * u;
		let lo = 0, hi = 1, u = t;
		for (let i = 0; i < 18; i++) {
			u = (lo + hi) / 2;
			if (B(0.6, 0.12, u) < t) lo = u;
			else hi = u;
		}
		return B(0, 1.12, u);
	};

	const COL = 380;
	const paneHook = (p, m) => {
		const e = spring(seg(p, 0, 0.85));
		const x = lerp(1280, COL, e);
		if (m.bg) {
			m.bg.style.transform = `translateX(${(x - COL).toFixed(1)}px)`;
			m.bg.style.opacity = Math.min(1, e * 3).toFixed(3);
		}
		if (m.pane) m.pane.style.clipPath = p >= 1 ? '' : `inset(0 0 0 ${Math.max(0, x - COL).toFixed(1)}px)`;
	};
	const SCENES = {
		today: {
			share: {date: {at: 0, dur: 0.85, fade: [0.4, 0.8]}, ring: {at: 0.02, dur: 0.86, fade: [0.5, 0.85]}, total: {at: 0.03, dur: 0.86, fade: [0.5, 0.85]}, norm: {at: 0.04, dur: 0.86, fade: [0.4, 0.8]}, line: {at: 0.05, dur: 0.86, mode: 'u', fade: [0.45, 0.85]}, cta: {at: 0.07, dur: 0.86, fade: [0.4, 0.8]}},
			pre: paneHook,
		},
		week: {
			share: {wtotal: {at: 0, dur: 0.86, fade: [0.3, 0.8]}, wcta: {at: 0.08, dur: 0.86, fade: [0.15, 0.5]}, day0: {at: 0.02, dur: 0.8}, day1: {at: 0.04, dur: 0.8}, day2: {at: 0.06, dur: 0.8}, day3: {at: 0.08, dur: 0.8}, day4: {at: 0.1, dur: 0.8}},
			pre: paneHook,
		},
	};

	function fxStyle(el, kind, e) {
		let o = e, t = '', f = '';
		switch (kind) {
			case 'up': t = `translateY(${(1 - e) * 26}px)`; break;
			case 'down': t = `translateY(${-(1 - e) * 18}px)`; break;
			case 'left': t = `translateX(${-(1 - e) * 56}px)`; break;
			case 'right': t = `translateX(${(1 - e) * 72}px)`; break;
			case 'pop': t = `translateY(${(1 - e) * 18}px) scale(${0.92 + 0.08 * e})`; break;
			case 'recede': t = `translateY(${-(1 - e) * 16}px) scale(${0.94 + 0.06 * e})`; f = `blur(${(1 - e) * 8}px)`; break;
			case 'growx': t = `scaleX(${0.001 + 0.999 * e})`; o = Math.min(1, e * 2.5); break;
		}
		el.style.opacity = o >= 1 ? '' : o.toFixed(3);
		if (kind !== 'fade') el.style.transform = e >= 1 ? '' : t;
		el.style.filter = f && e < 1 && e > 0 ? f : '';
	}

	class Morph {
		constructor(win, opt) {
			this.win = win;
			this.opt = opt;
			this.p = -1;
			this.Ls = win.querySelector('.L-s');
			this.Ld = win.querySelector('.L-d');
			this.fx = win.querySelector('.fx');
			this.rim = win.querySelector('.rim');
			this.sheen = win.querySelector('.sheen');
			this.tint = win.querySelector('.tint');
			this.bg = win.querySelector('.panebg');
			this.pane = this.Ld.querySelector('.pane');
			win.querySelectorAll('[data-stg]').forEach((g) => {
				const [dir, kind, at, step, dur] = g.dataset.stg.split(',');
				[...g.children].forEach((c, i) => {
					c.dataset[dir] = kind;
					c.dataset.at = (+at + i * +step).toFixed(3);
					if (dur) c.dataset.dur = dur;
				});
			});
			this.ins = [...win.querySelectorAll('[data-in]')];
			this.outs = [...win.querySelectorAll('[data-out]')];
			this.measured = false;
		}
		rel(el) {
			const r = el.getBoundingClientRect(), w = this.win.getBoundingClientRect(), k = w.width / this.win.offsetWidth;
			return {x: (r.left - w.left) / k, y: (r.top - w.top) / k, w: r.width / k, h: r.height / k};
		}
		measure() {
			// measure every shared element at rest (no transforms applied)
			[...this.ins, ...this.outs].forEach((el) => {
				el.style.transform = '';
				el.style.opacity = '';
				el.style.filter = '';
			});
			this.pairs = [];
			this.fx.textContent = '';
			[...this.win.querySelectorAll('[data-share]')].filter((a) => !this.Ld.contains(a)).forEach((a) => {
				const key = a.dataset.share, b = this.Ld.querySelector(`[data-share="${key}"]`);
				if (!b) return;
				const ra = this.rel(a), rb = this.rel(b);
				const mk = (el, r) => {
					const c = el.cloneNode(true);
					c.removeAttribute('data-share');
					const cs = getComputedStyle(el);
					['fontFamily', 'fontSize', 'fontWeight', 'color', 'letterSpacing', 'lineHeight', 'textAlign', 'whiteSpace', 'fontVariantNumeric'].forEach((k) => (c.style[k] = cs[k]));
					c.style.width = r.w + 2 + 'px';
					c.style.height = r.h + 'px';
					c.style.display = cs.display === 'inline' ? 'inline-block' : cs.display;
					c.style.opacity = 0;
					this.fx.appendChild(c);
					return c;
				};
				const cfg = this.opt.share[key] || {};
				this.pairs.push({a, b, ra, rb, ca: mk(a, ra), cb: mk(b, rb), mode: cfg.mode || (Math.abs(ra.w / ra.h - rb.w / rb.h) < 0.25 ? 'u' : 'xy'), at: cfg.at ?? 0.04, dur: cfg.dur ?? 0.7, fade: cfg.fade || [0.18, 0.5]});
			});
			this.tg = this.win.querySelector('.tg');
			if (this.tg) {
				this.tgo = [...this.tg.querySelectorAll('[data-opt]')].map((s) => ({x: s.offsetLeft, w: s.offsetWidth}));
				this.thumb = this.tg.querySelector('.thumb');
			}
			this.measured = true;
			const p = this.p;
			this.p = -1;
			if (p >= 0) this.set(p);
		}
		set(p) {
			if (!this.measured) this.measure();
			if (p === this.p) return;
			this.p = p;
			this.opt.pre(p, this);
			const mid = p > 0 && p < 1;
			this.pairs.forEach((s) => {
				const e = spring(seg(p, s.at, s.dur));
				s.a.style.opacity = p <= 0 ? '' : 0;
				s.b.style.opacity = p >= 1 ? '' : 0;
				if (!mid) {
					s.ca.style.opacity = 0;
					s.cb.style.opacity = 0;
					return;
				}
				const r = {x: lerp(s.ra.x, s.rb.x, e), y: lerp(s.ra.y, s.rb.y, e), w: lerp(s.ra.w, s.rb.w, e), h: lerp(s.ra.h, s.rb.h, e)};
				const place = (c, r0) => {
					if (s.mode === 'u') {
						const k = r.w / r0.w;
						c.style.transform = `translate(${r.x + (r.w - r0.w * k) / 2}px,${r.y + (r.h - r0.h * k) / 2}px) scale(${k})`;
					} else c.style.transform = `translate(${r.x}px,${r.y}px) scale(${r.w / r0.w},${r.h / r0.h})`;
				};
				place(s.ca, s.ra);
				place(s.cb, s.rb);
				const x = inout(seg(e, s.fade[0], s.fade[1] - s.fade[0]));
				s.ca.style.opacity = (1 - x).toFixed(3);
				s.cb.style.opacity = x.toFixed(3);
			});
			this.ins.forEach((el) => fxStyle(el, el.dataset.in, out3(seg(p, +(el.dataset.at || 0.3), +(el.dataset.dur || 0.35)))));
			this.outs.forEach((el) => fxStyle(el, el.dataset.out, 1 - out3(seg(p, +(el.dataset.at || 0), +(el.dataset.dur || 0.3)))));
			this.Ls.style.visibility = p >= 1 ? 'hidden' : 'visible';
			this.Ld.style.visibility = p <= 0 ? 'hidden' : 'visible';
			// ambient magic: gradient rim and a light sweep while the panes move
			const bell = Math.sin(Math.PI * p);
			if (this.rim) {
				this.rim.style.opacity = (Math.pow(bell, 1.4) * 0.95).toFixed(3);
				this.rim.style.background = `conic-gradient(from ${(-60 + p * 300).toFixed(1)}deg,#6366f1,#a855f7,#ec4899,#f59e0b,#6366f1)`;
			}
			if (this.sheen) {
				const s = seg(p, 0.12, 0.6);
				this.sheen.style.opacity = (Math.sin(Math.PI * s) * 0.9).toFixed(3);
				this.sheen.style.transform = `translateX(${lerp(-45, 45, inout(s))}%)`;
			}
			if (this.tint) this.tint.style.opacity = (0.55 + 0.45 * inout(p)).toFixed(3);
			if (this.thumb && this.tgo) {
				const e = spring(seg(p, 0, 0.6)), [a, b] = this.tgo;
				this.thumb.style.transform = `translateX(${(lerp(a.x, b.x, e) - a.x).toFixed(1)}px)`;
				this.thumb.style.width = lerp(a.w, b.w, e) + 'px';
			}
		}
		go(to, ms) {
			cancelAnimationFrame(this.raf);
			const from = Math.max(0, this.p), d = (ms || 1250) * Math.abs(to - from) * (to < from ? 0.85 : 1);
			if (!d || reduced) return this.set(to);
			const t0 = performance.now();
			const tick = (now) => {
				const t = clamp((now - t0) / d);
				this.set(lerp(from, to, t));
				if (t < 1) this.raf = requestAnimationFrame(tick);
			};
			this.raf = requestAnimationFrame(tick);
		}
	}

	/* ---------- scroll-scrubbed stages (desktop) ---------- */
	const mqDesk = window.matchMedia('(min-width: 1000px) and (min-height: 600px)');
	const HEAD = 68;
	const stages = [...document.querySelectorAll('[data-stage]')]
		.map((el) => {
			const win = el.querySelector('.tt-desk .win');
			if (!win) return null;
			const name = el.dataset.stage;
			return {
				el,
				name,
				win,
				m: new Morph(win, SCENES[name]),
				track: el.querySelector('.stage-track'),
				frame: el.querySelector('.tt-frame'),
				floats: [...el.querySelectorAll('.float')].map((f) => ({f, d: +f.dataset.depth || 0})),
				btns: [...el.querySelectorAll('.modes [data-mode]')],
				// position inside the sticky run (0..1) → morph progress, with a dwell at both ends
				map: name === 'today' ? (s) => clamp((s - 0.1) / 0.6) : (s) => clamp((s - 0.08) / 0.55),
				vis: true,
				mode: 0,
			};
		})
		.filter(Boolean);

	// CSS computes the window scale with tan(atan2()); engines without it get it from here.
	const cssScale = window.CSS && CSS.supports('width', 'calc(1px * tan(atan2(1px, 2px)))');
	const fitScale = () => {
		if (cssScale) return;
		const k = Math.min(Math.min(innerWidth - 96, 1200) / 1280, (innerHeight - 230) / 800);
		stages.forEach((st) => st.el.style.setProperty('--k', Math.max(0.3, k).toFixed(4)));
	};

	const scrub = () => mqDesk.matches && !reduced && !q.has('p');
	const setMode = (st, p) => {
		const on = p >= 0.5 ? 1 : 0;
		if (on === st.mode && st.el.dataset.ready) return;
		st.mode = on;
		st.el.dataset.ready = '1';
		st.el.classList.toggle('is-d', !!on);
		st.btns.forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.mode === on)));
	};
	const range = (st) => st.track.offsetHeight - (innerHeight - HEAD);
	const stageS = (st) => clamp((HEAD - st.track.getBoundingClientRect().top) / Math.max(1, range(st)));
	// scroll positions (fraction of the sticky run) where each end state rests
	const REST = {today: [0.06, 0.74], week: [0.04, 0.66]};
	const restY = (st, on) => window.scrollY + st.track.getBoundingClientRect().top - HEAD + REST[st.name][on] * range(st);

	/* Snap ("подкрутка"): a small push into the scene commits the whole transition.
	   The morph plays by time with the prototype curve, and the page is carried to the
	   matching rest position; any user input against it cancels the carry. */
	const SNAP_T = 0.08; // share of the run between the two rest positions
	let snap = null; // {raf} while the page is being carried
	let dragging = false; // scrollbar drag: never move the page under the user's pointer
	const cancelSnap = () => {
		if (snap) cancelAnimationFrame(snap.raf);
		snap = null;
	};
	const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
	// in-page links smooth-scroll through the scenes: let them land, only the morph follows
	let navigating = false;
	document.addEventListener('click', (e) => {
		const a = e.target.closest('a[href*="#"]');
		if (a && a.pathname === location.pathname) {
			cancelSnap();
			navigating = true;
		}
	});
	const carryTo = (y) => {
		cancelSnap();
		if (dragging || navigating) return;
		const y0 = window.scrollY, dy = y - y0;
		if (Math.abs(dy) < 2) return;
		const d = clamp(Math.abs(dy) * 1.1, 420, 1000), t0 = performance.now();
		const s = {raf: 0, dir: Math.sign(dy)};
		const tick = (now) => {
			const t = clamp((now - t0) / d);
			window.scrollTo({top: y0 + dy * ease(t), behavior: 'instant'});
			if (t < 1 && snap === s) s.raf = requestAnimationFrame(tick);
			else if (snap === s) snap = null;
		};
		snap = s;
		s.raf = requestAnimationFrame(tick);
	};
	// wheel/trackpad inertia in the carry's direction rides along; against it, the user wins
	window.addEventListener('wheel', (e) => {
		if (snap && Math.sign(e.deltaY) !== snap.dir) cancelSnap();
	}, {passive: true});
	['touchstart', 'keydown', 'mousedown'].forEach((ev) => window.addEventListener(ev, cancelSnap, {passive: true}));
	window.addEventListener('wheel', () => (navigating = false), {passive: true});
	window.addEventListener('pointerdown', (e) => {
		if (e.clientX >= document.documentElement.clientWidth) dragging = true;
	}, {passive: true});
	window.addEventListener('pointerup', () => {
		if (dragging) {
			dragging = false;
			onIdle();
		}
	}, {passive: true});

	const commit = (st, on, carry) => {
		st.target = on;
		st.m.go(on);
		setMode(st, on);
		st.el.classList.toggle('is-logged', !!on);
		st.el.classList.add('is-moving');
		if (carry) carryTo(restY(st, on));
	};
	const updateStage = (st) => {
		const top = st.track.getBoundingClientRect().top;
		const s = stageS(st);
		const raw = st.map(s);
		if (!st.m.measured) {
			// measure the shared elements on the untilted window
			st.frame.style.transform = '';
			st.m.measure();
		}
		if (st.target === undefined) {
			st.target = raw >= 0.5 ? 1 : 0;
			st.m.set(st.target);
			setMode(st, st.target);
			st.el.classList.toggle('is-logged', !!st.target);
		} else {
			const dir = s - (st.s ?? s);
			const [r0, r1] = REST[st.name];
			// a small push past the rest position commits the transition; direction-aware, so our own
			// carry (which only moves toward the target) never flips it back
			if (st.target === 0 && s > r0 + SNAP_T * (r1 - r0) && dir > 0) commit(st, 1, s < r1);
			else if (st.target === 1 && s < r1 - SNAP_T * (r1 - r0) && dir < 0) commit(st, 0, s > r0);
		}
		st.s = s;
		if (raw > 0.02) st.el.classList.add('is-moving');
		// the window rises and un-tilts as it arrives under the header
		const rise = out3(clamp((innerHeight - top) / (innerHeight - HEAD)));
		st.frame.style.transform = rise >= 1 ? '' : `perspective(2000px) rotateX(${((1 - rise) * 10).toFixed(2)}deg) scale(${(0.94 + 0.06 * rise).toFixed(4)})`;
		st.floats.forEach(({f, d}) => (f.style.transform = `translate3d(0,${((0.5 - s) * d * 140 + (1 - rise) * d * 60).toFixed(1)}px,0)`));
	};
	// scroll came to rest between the ends: settle on the committed end
	const onIdle = () => {
		if (navigating) return void (navigating = false);
		if (!scrub() || snap || dragging) return;
		stages.forEach((st) => {
			if (!st.vis || st.target === undefined) return;
			const s = stageS(st), [r0, r1] = REST[st.name];
			if (s > r0 + 0.005 && s < r1 - 0.005) carryTo(restY(st, st.target));
		});
	};

	stages.forEach((st) => {
		// without scroll-scrubbing (reduced motion, ?p, small screens) a click plays the transition
		const pick = (on) => {
			if (scrub()) commit(st, on, true);
			else {
				st.m.go(on);
				setMode(st, on);
				st.el.classList.toggle('is-logged', !!on && st.name === 'week');
			}
		};
		st.btns.forEach((b) => b.addEventListener('click', () => pick(+b.dataset.mode)));
		st.win.addEventListener('click', (e) => {
			if (e.target.closest('[data-toggle]')) pick(st.mode ? 0 : 1);
		});
	});

	/* ---------- parallax: translate only, one rAF loop, passive listeners ---------- */
	const pxEls = [...document.querySelectorAll('[data-px]')].map((el) => ({el, k: +el.dataset.px, top: 0, h: 0, blob: el.classList.contains('blob')}));
	const pxOn = !reduced && 'translate' in document.documentElement.style;
	const measurePx = () => {
		if (!pxOn) return;
		pxEls.forEach((o) => {
			o.el.style.translate = 'none';
			const r = o.el.getBoundingClientRect();
			o.top = r.top + window.scrollY;
			o.h = r.height;
		});
	};
	const parallax = () => {
		if (!pxOn) return;
		const y = window.scrollY, vh = innerHeight, small = innerWidth < 760;
		pxEls.forEach((o) => {
			if (small && !o.blob) return void (o.el.style.translate = '');
			const c = o.top + o.h / 2;
			if (c < y - vh * 1.5 || c > y + vh * 2.5) return;
			const d = clamp((y + vh / 2 - c) * o.k, -160, 160);
			o.el.style.translate = `0 ${d.toFixed(1)}px`;
		});
	};

	/* ---------- one scroll loop ---------- */
	let ticking = false;
	const frame = () => {
		ticking = false;
		header && header.classList.toggle('is-scrolled', window.scrollY > 8);
		if (scrub()) stages.forEach((st) => st.vis && updateStage(st));
		parallax();
	};
	let idleT = 0;
	const onScroll = () => {
		clearTimeout(idleT);
		idleT = setTimeout(onIdle, 120);
		if (!ticking) {
			ticking = true;
			requestAnimationFrame(frame);
		}
	};

	if ('IntersectionObserver' in window) {
		const sio = new IntersectionObserver(
			(ens) => ens.forEach((en) => {
				const st = stages.find((x) => x.el === en.target);
				if (st) st.vis = en.isIntersecting;
			}),
			{rootMargin: '200px 0px'},
		);
		stages.forEach((st) => sio.observe(st.el));
	}

	const layout = () => {
		fitScale();
		stages.forEach((st) => {
			if (st.floats.length) st.el.classList.toggle('has-floats', (innerWidth - st.frame.offsetWidth) / 2 >= 150);
			st.m.measured = false;
			if (!mqDesk.matches) return;
			if (scrub()) return updateStage(st);
			const fixed = q.has('p') ? clamp(+q.get('p') || 0) : st.mode;
			st.m.set(fixed);
			setMode(st, fixed);
			st.el.classList.toggle('is-logged', fixed >= 1 && st.name === 'week');
			st.frame.style.transform = '';
		});
		measurePx();
		parallax();
	};

	let rT = 0;
	window.addEventListener('scroll', onScroll, {passive: true});
	window.addEventListener('resize', () => {
		clearTimeout(rT);
		rT = setTimeout(layout, 120);
	}, {passive: true});
	const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
	Promise.race([fontsReady, new Promise((r) => setTimeout(r, 2500))]).then(() => requestAnimationFrame(() => {
		layout();
		frame();
	}));
	window.addEventListener('load', () => {
		measurePx();
		parallax();
	});
	frame();
})();
