import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher; // Reverb memakai protokol Pusher

const https = import.meta.env.VITE_REVERB_SCHEME === 'https';

export default new Echo({
  broadcaster: 'reverb',
  key: import.meta.env.VITE_REVERB_APP_KEY,
  wsHost: import.meta.env.VITE_REVERB_HOST,
  wsPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
  wssPort: Number(import.meta.env.VITE_REVERB_PORT ?? 443),
  forceTLS: https,
  enabledTransports: ['ws', 'wss'],
});
