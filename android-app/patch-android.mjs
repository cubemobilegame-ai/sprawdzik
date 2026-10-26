// EduSkan: orientacja pionowa, aparat, numer wersji, API 36, ikony i ekran startowy.
import fs from "fs";
import path from "path";
const versionCode = parseInt(process.env.VERSION_CODE || "1", 10);
const versionName = (process.env.VERSION_NAME || "1.0.0").replace(/[^0-9A-Za-z.\-]/g, "");
const RES = "android/app/src/main/res";

const mf = "android/app/src/main/AndroidManifest.xml";
let m = fs.readFileSync(mf, "utf8");
if (!m.includes("screenOrientation")) m = m.replace(/<activity\b/, '<activity android:screenOrientation="portrait"');
if (!m.includes("android.permission.CAMERA")) m = m.replace("<application", '<uses-permission android:name="android.permission.CAMERA" />\n    <uses-feature android:name="android.hardware.camera" android:required="false" />\n\n    <application');
m = m.replace(/android:allowBackup="true"/, 'android:allowBackup="false"');
fs.writeFileSync(mf, m);

const bg = "android/app/build.gradle";
let g = fs.readFileSync(bg, "utf8");
g = g.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`).replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);
fs.writeFileSync(bg, g);

const vf = "android/variables.gradle";
if (fs.existsSync(vf)) {
  let v = fs.readFileSync(vf, "utf8");
  for (const key of ["compileSdkVersion", "targetSdkVersion"]) v = v.replace(new RegExp(`${key}\\s*=\\s*(\\d+)`), (a, n) => `${key} = ${Math.max(36, parseInt(n, 10))}`);
  fs.writeFileSync(vf, v);
}

// ikony (adaptacyjne: granat + ramka skanera z ptaszkiem)
const src = "res";
for (const d of fs.readdirSync(src)) {
  const p = path.join(src, d);
  if (!fs.statSync(p).isDirectory()) continue;
  fs.mkdirSync(path.join(RES, d), { recursive: true });
  for (const f of fs.readdirSync(p)) fs.copyFileSync(path.join(p, f), path.join(RES, d, f));
}
fs.mkdirSync(path.join(RES, "values"), { recursive: true });
fs.writeFileSync(path.join(RES, "values/ic_launcher_background.xml"), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#312E81</color>\n</resources>\n`);

// ekran startowy: granatowe tło + logo (zamiast logo Capacitora)
for (const d of fs.readdirSync(RES)) {
  if (!d.startsWith("drawable")) continue;
  for (const f of fs.readdirSync(path.join(RES, d))) if (/^splash\.(png|9\.png|jpg)$/.test(f)) fs.unlinkSync(path.join(RES, d, f));
}
fs.mkdirSync(path.join(RES, "drawable-xxhdpi"), { recursive: true });
fs.copyFileSync("res/splash_logo.png", path.join(RES, "drawable-xxhdpi/splash_logo.png"));
fs.rmSync(path.join(RES, "splash_logo.png"), { force: true });
fs.mkdirSync(path.join(RES, "drawable"), { recursive: true });
fs.writeFileSync(path.join(RES, "drawable/splash.xml"), `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/ic_launcher_background" />
    <item android:gravity="center" android:width="144dp" android:height="144dp" android:drawable="@drawable/splash_logo" />
</layer-list>
`);
console.log(`Android gotowy: wersja ${versionName} (${versionCode})`);
