# PM2 kurulumu (Windows Server, internetsiz, yönetici yetkisi olmadan)

Bu belge, uygulamanın sunucuda PM2 ile çalıştırılmasını, hata durumunda ve sunucu
yeniden başladığında otomatik olarak geri gelmesini anlatır. Örneklerde proje klasörü
`C:\app` olarak geçiyor; kendi yolunuzla değiştirin. Klasörün adını `app` bırakın:
`middleware/upload.js` yükleme klasörünü bu ada göre buluyor. Komutları **Komut İstemi
(cmd.exe)** içinde, proje klasöründe çalıştırın.

## PM2 neyi çalıştırır

`ecosystem.config.js` süreç sayılarını ve bellek limitlerini makineye göre hesaplar.
8 GB RAM / 4 vCPU için:

| Uygulama | Mod | Adet | Bellek limiti (heap) | Boştayken bellek |
|---|---|---|---|---|
| `redis` (`redis-server.exe`, bkz. bölüm 8) | fork | 1 | – | birkaç MB |
| `app-server` (web, `server.js`) | cluster | 4 (her çekirdek için 1) | 2048 MB | ~0,4 GB / kopya |
| `geo-worker` | fork | 2 | 2048 MB | ~0,4 GB / kopya |
| `excel-import-worker` | fork | 1 | 4096 MB | ~0,1 GB (import sırasında artar) |
| `log-rotate` | saatte bir çalışır | 1 | – | çalışıp kapanır |

Toplam boştaki kullanım ~2,7 GB'tır (başlatıldıktan sonraki ilk dakikalarda, GeoJSON
yüklenirken geçici olarak ~4 GB'a çıkar). Geri kalan RAM Windows, PostgreSQL, Redis ve
import sırasındaki artış için kalır. Node.js tek bir süreçte varsayılan olarak yalnızca
~2 GB heap kullanır; limitler bu yüzden dosyada açıkça verilir.

- Bir süreç çökerse PM2 onu hemen yeniden başlatır. Art arda çökmelerde bekleme süresi
  0,1 sn'den başlayıp 15 sn'ye kadar artar (örneğin açılışta PostgreSQL/Redis henüz
  hazır değilse).
- Bir web kopyası çökerse diğer üçü istekleri karşılamaya devam eder.
- Worker'lar durdurulurken (restart/reload/stop) ellerindeki işi bitirip öyle kapanır.
  Excel import'u için en fazla 10 dk, geo işi için en fazla 2 dk beklenir. Boştaki
  worker hemen kapanır. Redis de kapatılmışsa iş zaten tamamlanamayacağı için en fazla
  15 sn beklenir.

## 1. Ön koşullar (sunucuda bir kez kontrol)

1. Node.js 18 veya üstü: `node -v`
2. PostgreSQL çalışıyor ve **açılışta otomatik başlıyor** olmalı. PowerShell'de:
   ```powershell
   Get-Service *postgres* | Select Name, Status, StartType
   ```
   `StartType` değeri `Automatic` olmalı.
3. Redis'i PM2 başlatır (bölüm 8). PM2'yi ilk kez başlatmadan önce elle açtığınız
   Redis penceresini kapatın; yoksa 6379 portu dolu olur.
4. Proje klasöründe `.env` dosyası bulunmalı.

## 2. Dosyaları hazırlama (internetli bilgisayarda)

PM2 artık `package.json` içinde bir bağımlılık. Ayrıca kurmanız ya da global
yüklemeniz gerekmez.

```bat
cd /d C:\Users\...\GitHub\app
git pull
npm ci
```

Ardından proje klasörünün tamamını **`node_modules` dahil** sunucuya kopyalayın
(`.env` sunucudaki hâliyle kalsın). Geliştirme bilgisayarı da Windows olduğu için
`node_modules` doğrudan çalışır.

## 3. İlk çalıştırma (sunucuda)

```bat
cd /d C:\app
npx pm2 start ecosystem.config.js
npx pm2 ls
npx pm2 save
```

- `npx pm2 ls`: tüm süreçler `online` olmalı (`log-rotate` normalde `stopped` görünür).
- `npx pm2 save`: çalışan listeyi `%USERPROFILE%\.pm2\dump.pm2` dosyasına kaydeder.
  Açılışta bu liste geri yüklenir. **Listeyi her değiştirdiğinizde tekrar çalıştırın.**
- `npx` internete çıkmaz, projedeki `node_modules\pm2`'yi kullanır. PowerShell
  "running scripts is disabled" hatası verirse komutları cmd.exe'de çalıştırın ya da
  `npx.cmd` yazın.

## 4. Sunucu yeniden başladığında otomatik başlatma

Windows'ta `pm2 startup` komutu çalışmaz. İki yol var; ikisi de
`scripts\pm2-boot.cmd` dosyasını çalıştırır. Bu dosya `pm2 resurrect` ile kayıtlı
listeyi geri yükler. Uygulamalar zaten çalışıyorsa bir şey yapmaz, kopya da açmaz.
Çıktısı `%USERPROFILE%\.pm2\boot.log` dosyasına yazılır.

### A) Yönetici yetkisi gerekmez: oturum açılınca başlar

1. `Win + R` → `shell:startup` → Enter.
2. Açılan klasörde sağ tık → Yeni → Kısayol → hedef:
   `C:\app\scripts\pm2-boot.cmd`
3. İsterseniz kısayolun özelliklerinde "Çalıştır" alanını "Simge durumuna küçültülmüş"
   (Minimized) yapın.

Sınırlamalar:
- Sunucu yeniden başladıktan sonra uygulama, bu kullanıcı **oturum açtığında** başlar
  (bir kez RDP ile bağlanmak yeterli).
- RDP'den çıkarken **"Oturumu kapat / Sign out" yapmayın**, pencereyi kapatıp bağlantıyı
  kesin. Oturum kapatılırsa Windows PM2'yi ve uygulamaları da kapatır.
- Bazı kurumlarda grup ilkesi, bağlantısı kesilmiş oturumları belli bir süre sonra
  kapatır. Böyle bir ayar varsa B yöntemi gerekir.

### B) Önerilen: BT'den bir kerelik yardım (oturum açmadan, gerçek açılışta)

Açılışta oturum açılmadan başlatmak Windows'ta yönetici işlemidir. Yöneticinin bir kez
Görev Zamanlayıcı'da (taskschd.msc) şu görevi oluşturması yeterli:

- **General:** kullanıcı olarak `pm2 save` komutunu çalıştıran hesap seçilir ve
  "Run whether user is logged on or not" işaretlenir. "Run with highest privileges"
  gerekmez.
- **Triggers:** "At startup", "Delay task for: 1 minute".
- **Actions:** "Start a program", Program: `C:\app\scripts\pm2-boot.cmd`,
  "Start in": `C:\app`
- **Settings:** "Stop the task if it runs longer than: 3 days" işaretini **kaldırın**
  (görev süre sınırına takılıp PM2'yi kapatmasın). "If the task is already running:
  Do not start a new instance".
- Hesabın "Log on as a batch job" hakkı yoksa yönetici bu hakkı verir.

Aynı görev PowerShell ile de oluşturulabilir (yönetici olarak):

```powershell
$cred = Get-Credential   # uygulamayı çalıştıran kullanıcı
$action = New-ScheduledTaskAction -Execute "C:\app\scripts\pm2-boot.cmd" -WorkingDirectory "C:\app"
$trigger = New-ScheduledTaskTrigger -AtStartup
$trigger.Delay = "PT1M"
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName "PM2 mta_app" -Action $action -Trigger $trigger -Settings $settings -User $cred.UserName -Password $cred.GetNetworkCredential().Password
```

Test: görevde sağ tık → Çalıştır, sonra `npx pm2 ls`. A ve B birlikte kurulu olabilir;
çift başlatma olmaz.

## 5. Günlük kullanım

| Ne | Komut |
|---|---|
| Durum | `npx pm2 ls` |
| Canlı CPU/bellek | `npx pm2 monit` |
| Loglar | `npx pm2 logs` · `npx pm2 logs geo-worker --lines 200` |
| Yeniden başlat | `npx pm2 restart geo-worker` |
| Tümünü durdur | `npx pm2 stop all` |

Excel import'u sürerken `stop all` ya da `kill` kullanmayın. Redis de durduğu için
import tamamlanamaz; sonradan baştan çalışır ve satırları ikinci kez ekler. Önce
import'un bitmesini bekleyin (kuyruklar: `http://sunucu:8080/admin/queues`).

**Kod güncellemesi:** yeni dosyaları kopyalayın (`.env` korunsun), sonra:

```bat
npx pm2 reload ecosystem.config.js --only app-server,geo-worker,excel-import-worker
npx pm2 save
```

Redis'e dokunulmaz. Web kopyaları sırayla yenilenir ve site kesintisiz çalışır.
Worker'lar ellerindeki işi bitirmeyi bekler; Excel import'u sürüyorsa komut birkaç
dakika sürebilir. PM2 sürümü değiştiyse ayrıca `npx pm2 update` çalıştırın.

## 6. Ayar değiştirme (çekirdek / RAM)

Varsayılanlar `ecosystem.config.js` başında hesaplanır. Farklı bir değer için kalıcı
bir kullanıcı ortam değişkeni tanımlayın (`setx` yönetici yetkisi istemez; kod
güncellemesinde dosya değişse de ayar korunur):

```bat
setx WEB_INSTANCES 3
setx GEO_WORKERS 1
```

Sonra **yeni** bir cmd penceresinde süreçleri yeniden oluşturun:

```bat
cd /d C:\app
npx pm2 delete all
npx pm2 start ecosystem.config.js
npx pm2 save
```

Değişkenler: `WEB_INSTANCES`, `GEO_WORKERS`, `EXCEL_WORKERS`, `WEB_HEAP_MB`,
`GEO_HEAP_MB`, `EXCEL_HEAP_MB` (MB). Bir ayarı kaldırmak için
`reg delete HKCU\Environment /v WEB_INSTANCES /f`.

## 7. Loglar

- Yer: `%USERPROFILE%\.pm2\logs` (her uygulama için `-out.log` ve `-error.log`).
- `log-rotate` saatte bir 20 MB'ı geçen dosyayı `<ad>__<tarih>.log` olarak ayırır,
  14 günden eski parçaları siler. `pm2-logrotate` modülü internet olmadan
  kurulamadığı için bu iş projedeki `scripts/rotate-logs.js` ile yapılıyor.
  Elle çalıştırmak için: `node scripts\rotate-logs.js`. Sınırlar `LOG_MAX_MB` ve
  `LOG_KEEP_DAYS` değişkenleriyle değiştirilebilir.
- Not: geo-worker her satır için log yazdığından satır başına ~3 KB log oluşur
  (100.000 satır ≈ 300 MB).

## 8. Redis

PM2, `redis-server.exe` dosyasını şu klasörden çalıştırır:
`C:\Users\Busrabihter.kurt\Desktop\redis-windows-master\redis-windows-master`
(`redis-cli.exe` yalnızca istemcidir; sunucu aynı klasördeki `redis-server.exe`).

- Klasörde `redis.conf` ya da `redis.windows.conf` varsa o kullanılır. Yoksa Redis
  varsayılan ayarlarla ve yalnızca `127.0.0.1` üzerinde dinler.
- Veri dosyası (`dump.rdb`) aynı klasöre yazılır.
- Klasör yanlışsa `npx pm2 start` şu uyarıyı verir:
  `[ecosystem] ...redis-server.exe not found`. Başka bir klasör kullanmak için:
  ```bat
  setx REDIS_DIR "D:\redis"
  ```
  ardından yeni bir cmd penceresinde `npx pm2 delete all`,
  `npx pm2 start ecosystem.config.js`, `npx pm2 save`.
- Kontrol: Redis klasöründe `redis-cli ping` komutu `PONG` döndürmeli.

**İsteğe bağlı, önerilir:** Windows'ta PM2, Redis'i durdururken ya da sunucu yeniden
başlarken süreci zorla kapatır. Bu durumda son kayıttan (snapshot) sonraki kuyruk
değişiklikleri kaybolabilir. Kaybı en fazla 1 saniyeye indirmek için AOF'u açın:
`redis-cli config set appendonly yes`. Kalıcı olması için config dosyasındaki
`appendonly no` satırını `appendonly yes` yapın.

## 9. Sorun giderme

- **Bir uygulama sürekli yeniden başlıyor (↺ artıyor):**
  `npx pm2 logs <ad> --lines 100` ile hatayı görün. Çoğunlukla `.env`,
  PostgreSQL veya Redis bağlantısıyla ilgilidir.
- **`redis` sürekli yeniden başlıyor:** `npx pm2 logs redis` çıktısında 6379 portu
  için bir `bind` hatası varsa portu elle açılmış başka bir Redis kullanıyordur; onu
  kapatın.
- **Açılıştan sonra hiçbir şey çalışmıyor:** `%USERPROFILE%\.pm2\boot.log` dosyasına
  bakın. `node` bulunamadıysa `scripts\pm2-boot.cmd` içindeki `NODE` satırına
  `node.exe`'nin tam yolunu yazın. `npx pm2 save` yapılmış olmalı.
- **`pm2 ls` bellek/CPU göstermiyor:** PM2 7.1, Windows Server 2025'te WMIC yoksa
  PowerShell'e geçer. Yine görünmüyorsa uygulamalar çalışır, yalnızca bellek
  sınırına göre yeniden başlatma devre dışı kalır.
- **Ayar değişikliği uygulanmadı:** `npx pm2 delete all`, `npx pm2 start ecosystem.config.js`,
  `npx pm2 save`.
