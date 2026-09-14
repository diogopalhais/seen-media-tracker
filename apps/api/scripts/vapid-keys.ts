import webPush from 'web-push';

/** Prints a fresh VAPID key pair for the API environment. Keep the private key with your other secrets. */
const keys = webPush.generateVAPIDKeys();
process.stderr.write(
  'Add these to the API environment (Coolify → Environment Variables), together with VAPID_SUBJECT (mailto:you@example.com or your site URL):\n\n',
);
process.stdout.write(`VAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\n`);
