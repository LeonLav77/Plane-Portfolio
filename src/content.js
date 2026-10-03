// Everything on the island signboards lives here.
// Each board supports: title, meta, text, bullets[], tags[], link { label, url }.
// Keep boards short — they're signs, not essays. Add more boards instead.
//
// Test data pulled from github.com/LeonLav77. Anything marked TODO isn't public — fill it in.

const GH = 'https://github.com/LeonLav77';

export const ISLANDS = [
  {
    id: 'home',
    name: 'Base Camp',
    subtitle: 'About me',
    kind: 'home',
    position: [0, 0, 0],
    color: '#7bd88f',
    boards: [
      {
        title: "Hey, I'm Leon 👋",
        meta: 'Backend engineer · Pula, Croatia',
        text: 'Leon Kardas. I build the stuff you never see: microservices, real-time backends and self-hosted everything. This little world is my portfolio. Have a look around.',
      },
      {
        title: 'What I do',
        bullets: [
          'Distributed systems in Go: queues, consensus, caching',
          'Real-time backends over WebSockets and SignalR',
          'Laravel packages, and my own PHP framework for fun',
          'A home lab running my side projects (Docker + Traefik)',
        ],
      },
      {
        title: 'My toolbox',
        text: 'The stuff I reach for most:',
        tags: ['Go', 'PHP', 'Laravel', 'Python', 'C# / .NET', 'TypeScript', 'PostgreSQL', 'Redis', 'RabbitMQ', 'etcd', 'Docker', 'Traefik'],
      },
      {
        title: 'How to explore',
        text: 'Walk up to a sign and press E. Go back to the plane to fly to the next island.',
        bullets: ['Work Experience: the city', 'Server Farm: backend builds', 'Side Quests: the volcano', 'Lighthouse: contact'],
      },
    ],
  },
  {
    id: 'experience',
    name: 'Work Experience',
    subtitle: 'Where I’ve flown',
    kind: 'city',
    position: [400, 0, -450],
    color: '#ffb454',
    boards: [
      {
        title: 'Lloyds Digital',
        meta: 'Backend Engineer · TODO dates',
        bullets: ['TODO: what you work on there', 'TODO: biggest win / impact', 'TODO: team, stack, scale'],
        tags: ['Laravel', 'PHP', 'TODO'],
      },
      {
        title: 'Earlier role',
        meta: 'TODO company · TODO dates',
        bullets: ['TODO: or delete this board'],
      },
      {
        title: 'Studies',
        meta: 'TODO university · TODO years',
        text: 'Course projects so far include Android, .NET, Angular, operating systems in C, blockchain and simulation & modelling.',
      },
      {
        title: 'Shipping since 2019',
        text: 'First commit on GitHub in 2019. 37 public repos since then, from Laravel CRMs to Go microservices.',
        link: { label: 'See all repos', url: `${GH}?tab=repositories` },
      },
    ],
  },
  {
    id: 'work',
    name: 'The Server Farm',
    subtitle: 'Backend builds',
    kind: 'lab',
    position: [-500, 0, -260],
    color: '#4cc9f0',
    boards: [
      {
        title: 'Distributed Ticketing',
        meta: 'Concert ticket sales at scale',
        text: '8 Go microservices behind a WebSocket queue. etcd (Raft) holds ticket stock with compare-and-swap reservations, so no double-selling.',
        tags: ['Go', 'etcd', 'Redis', 'RabbitMQ', 'PostgreSQL'],
        link: { label: 'View repo', url: `${GH}/Distributed-Ticketing-System` },
      },
      {
        title: 'PhotoRoulette Backend',
        meta: 'Real-time multiplayer game',
        text: 'Guess who sent which photo. Parallel lobbies, auto-scored rounds, Google OAuth and roles. Self-hosted on Ubuntu behind Apache.',
        tags: ['C#', '.NET', 'SignalR', 'OAuth'],
        link: { label: 'View repo', url: `${GH}/photoroullete-backend` },
      },
      {
        title: 'Nias Age Verification',
        meta: 'Laravel package',
        text: 'Adult checks via the Croatian e-Građani system for online alcohol sales (NN 59/2026). It stores only a yes/no answer, never an identity.',
        tags: ['Laravel', 'PHP', 'OAuth'],
        link: { label: 'View repo', url: `${GH}/nias` },
      },
      {
        title: 'Frejm',
        meta: '"Another PHP Framework??"',
        text: 'A Laravel-inspired framework built from scratch: routing, middleware, migrations, config and a custom autoloader.',
        tags: ['PHP', 'Composer'],
        link: { label: 'View repo', url: `${GH}/Frejm` },
      },
    ],
  },
  {
    id: 'personal',
    name: 'Side Quests',
    subtitle: 'Personal projects',
    kind: 'volcano',
    position: [-320, 0, 430],
    color: '#ff7b54',
    boards: [
      {
        title: 'typa',
        meta: 'Typing test · Go',
        text: 'A fast, keyboard-only typing test. A single Go binary with its assets embedded, and insights from every keystroke. Deployed to my home lab.',
        tags: ['Go', 'SQLite', 'Docker', 'Traefik'],
        link: { label: 'View repo', url: `${GH}/typa` },
      },
      {
        title: 'Music Master',
        meta: 'Guitar amp control',
        text: 'Controls a BOSS Katana MkII amp over USB MIDI SysEx, tested on the real amp. FastAPI + WebSocket API, aiming at a Raspberry Pi touchscreen.',
        tags: ['Python', 'MIDI', 'FastAPI', 'Raspberry Pi'],
        link: { label: 'View repo', url: `${GH}/music-master` },
      },
      {
        title: 'Sunways',
        meta: 'Rooftop solar dashboard',
        text: 'Polls the inverter every 10 minutes and compares output with measured sunlight, corrected for panel temperature, to spot real faults.',
        tags: ['Python', 'SQLite', 'Open-Meteo', 'Docker'],
        link: { label: 'View repo', url: `${GH}/sunways` },
      },
      {
        title: 'Nogomet na TV',
        meta: 'Football TV guide',
        text: 'Scrapes ~50 Croatian and regional sports channels into a single "what match is on tonight" dashboard.',
        tags: ['Python', 'Scraping', 'nginx'],
        link: { label: 'View repo', url: `${GH}/nogomet-na-tv` },
      },
      {
        title: 'Bike-share Simulation',
        meta: 'Modelling & simulation',
        text: 'Simulates trips between bike-share stations to compare redistribution strategies, with sensitivity analysis.',
        tags: ['Python', 'Simulation'],
        link: { label: 'View repo', url: `${GH}/bajs-simulation-project` },
      },
    ],
  },
  {
    id: 'contact',
    name: 'Lighthouse',
    subtitle: 'Contact',
    kind: 'lighthouse',
    position: [470, 0, 330],
    color: '#ff6b81',
    boards: [
      {
        title: 'Send a signal',
        text: 'I usually answer faster than my cron jobs run. Pick a sign and press Enter to open it.',
      },
      { title: 'GitHub', text: 'github.com/LeonLav77', link: { label: 'Open GitHub', url: GH } },
      { title: 'Email', text: 'TODO: your public email', link: { label: 'Write me', url: 'mailto:you@example.com' } },
      { title: 'LinkedIn', text: 'TODO: your LinkedIn', link: { label: 'Open LinkedIn', url: 'https://linkedin.com/' } },
    ],
  },
];
