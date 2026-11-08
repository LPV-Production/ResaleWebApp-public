// Fabrique les icônes de l'appli (écran d'accueil du téléphone) à partir d'un dessin SVG.
// À relancer seulement si on change le logo :  node scripts/generer-icones.mjs
import sharp from 'sharp';

// Étiquette blanche sur fond indigo, centrée avec de la marge (Android découpe parfois l'icône en rond)
const svg = (bg = true) => Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  ${bg ? '<rect width="512" height="512" fill="#4f46e5"/>' : ''}
  <g transform="translate(136 136) scale(10)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/>
    <circle cx="7.5" cy="7.5" r="1.2" fill="#fff"/>
  </g>
</svg>`);

await sharp(svg()).resize(512, 512).png().toFile('public/icons/icon-512.png');
await sharp(svg()).resize(192, 192).png().toFile('public/icons/icon-192.png');
await sharp(svg()).resize(180, 180).png().toFile('public/icons/apple-touch-icon.png');
// Petite icône monochrome pour la barre de notifications Android
await sharp(svg(false)).resize(96, 96).png().toFile('public/icons/badge-96.png');
console.log('✓ Icônes créées dans public/icons/');
