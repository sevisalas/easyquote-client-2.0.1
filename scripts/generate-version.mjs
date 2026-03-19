import { writeFileSync } from 'fs';

const version = {
  buildTime: new Date().toISOString(),
  hash: Date.now().toString(36)
};

writeFileSync('dist/version.json', JSON.stringify(version));
console.log('✅ version.json generated:', version);
