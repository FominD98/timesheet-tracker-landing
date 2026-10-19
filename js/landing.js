/* Timesheet Tracker landing — small vanilla JS, no dependencies. */

const WAITLIST_ENDPOINT = 'https://waitlist.danielformind.workers.dev/subscribe';

/* Analytics placeholder — intentionally off for now.
   When ready, load a privacy-friendly script here (no cookies) and call it from track().
   function track(name, props) {}
*/

(function () {
	'use strict';

	const doc = document.documentElement;
	doc.classList.add('js');
	const lang = (doc.lang || 'en').slice(0, 2) === 'ru' ? 'ru' : 'en';
	// ?static renders the final state of every animation (used for screenshots).
	const isStatic = /[?&]static\b/.test(location.search);
	if (isStatic) doc.classList.add('static');
	const reduced = isStatic || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	const T = {
		en: {
			invalid: 'Please enter a valid email address.',
			sending: 'Adding you to the list…',
			error: 'Something went wrong. Please try again in a minute.',
			network: 'Could not reach the server. Check your connection and try again.',
		},
		ru: {
			invalid: 'Проверьте адрес — кажется, в нём опечатка.',
			sending: 'Добавляем вас в список…',
			error: 'Что-то пошло не так. Попробуйте ещё раз через минуту.',
			network: 'Сервер недоступен. Проверьте интернет и попробуйте снова.',
		},
	}[lang];

	/* ---------- header: shadow on scroll + mobile menu ---------- */
	const header = document.querySelector('.site-header');
	const onScroll = () => header && header.classList.toggle('is-scrolled', window.scrollY > 8);
	onScroll();
	window.addEventListener('scroll', onScroll, {passive: true});

	const toggle = document.querySelector('.nav-toggle');
	if (toggle) {
		toggle.addEventListener('click', () => {
			const open = document.body.classList.toggle('nav-open');
			toggle.setAttribute('aria-expanded', String(open));
		});
		document.querySelectorAll('.nav-links a').forEach((a) =>
			a.addEventListener('click', () => {
				document.body.classList.remove('nav-open');
				toggle.setAttribute('aria-expanded', 'false');
			}),
		);
	}

	/* ---------- waitlist forms ---------- */
	const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

	document.querySelectorAll('form[data-waitlist]').forEach((form) => {
		const input = form.querySelector('input[type="email"]');
		const hp = form.querySelector('input[name="website"]');
		const msg = form.querySelector('.wl-msg');
		const setState = (state, text) => {
			form.dataset.state = state;
			if (msg) msg.textContent = text || '';
			input.setAttribute('aria-invalid', state === 'error' ? 'true' : 'false');
		};

		input.addEventListener('input', () => {
			if (form.dataset.state === 'error') setState('idle', '');
		});

		form.addEventListener('submit', async (e) => {
			e.preventDefault();
			if (form.dataset.state === 'loading') return;
			const email = input.value.trim();
			if (!EMAIL_RE.test(email) || email.length > 254) {
				setState('error', T.invalid);
				input.focus();
				return;
			}
			setState('loading', T.sending);
			try {
				const res = await fetch(WAITLIST_ENDPOINT, {
					method: 'POST',
					headers: {'Content-Type': 'application/json'},
					body: JSON.stringify({
						email,
						lang,
						source: 'landing',
						page: location.pathname,
						website: hp ? hp.value : '',
					}),
				});
				let data = null;
				try {
					data = await res.json();
				} catch (_) {
					/* non-JSON reply */
				}
				if (res.ok && data && data.ok) {
					setState('success', '');
					const done = form.querySelector('.wl-done');
					if (done) {
						done.setAttribute('tabindex', '-1');
						done.focus({preventScroll: true});
					}
				} else {
					setState('error', (data && data.error && /email/i.test(data.error) && T.invalid) || T.error);
				}
			} catch (_) {
				setState('error', T.network);
			}
		});
	});

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
			{rootMargin: '0px 0px -12% 0px', threshold: 0.12},
		);
		revealEls.forEach((el) => io.observe(el));
	} else {
		revealEls.forEach((el) => el.classList.add('in'));
	}

	/* ---------- hero demo: "Sort my day" ---------- */
	const win = document.querySelector('[data-demo]');
	if (win) {
		const btn = win.querySelector('.sort-btn');
		let timer = 0;
		const sort = () => {
			if (win.classList.contains('is-sorted') || win.classList.contains('is-thinking')) return;
			clearTimeout(timer);
			if (reduced) {
				win.classList.add('is-sorted');
				return;
			}
			win.classList.add('is-thinking');
			setTimeout(() => {
				win.classList.remove('is-thinking');
				win.classList.add('is-sorted');
			}, 1300);
		};
		btn && btn.addEventListener('click', sort);
		const replay = win.querySelector('[data-replay]');
		replay &&
			replay.addEventListener('click', () => {
				win.classList.remove('is-sorted');
				setTimeout(sort, 900);
			});
		// Auto-play once the window has been on screen for a moment.
		if (isStatic) {
			sort();
		} else if ('IntersectionObserver' in window) {
			const io2 = new IntersectionObserver(
				(entries) => {
					if (entries.some((en) => en.isIntersecting)) {
						timer = setTimeout(sort, reduced ? 0 : 2600);
						io2.disconnect();
					}
				},
				{threshold: 0.35},
			);
			io2.observe(win);
		}
	}

	/* ---------- footer year ---------- */
	document.querySelectorAll('[data-year]').forEach((el) => (el.textContent = String(new Date().getFullYear())));
})();
