# RL-C1（リルシィ）Discord ボット

レベル・チャンネル間翻訳・AI・Web ダッシュボードを持つ、通常ボット（discord.js v14）です。セルフボットは使いません。

## 作る順番と進み具合

| 段階 | 内容 | 状態 |
|---|---|---|
| 1 | 土台（起動・自動読み込み・Redis・/help） | ✅ |
| 2 | レベル（/rank /leaderboard /level-config） | 未 |
| 3 | 翻訳（ペア・/translate・右クリック翻訳・AIレビュー） | 未 |
| 4 | /ask | 未 |
| 5 | ダッシュボード | 未 |

## フォルダ構成

```
index.js              起動。環境変数の確認 → 読み込み → Redis 確認 → ログイン
deploy-commands.js    スラッシュコマンドの登録
commands/             1コマンド = 1ファイル（data と execute を export）
events/               1イベント = 1ファイル（name と execute を export）
features/             レベル・翻訳・AI の本体（段階2〜4）
lib/
  env.js              環境変数の確認（足りなければ終了）
  log.js              ログ（トークン類を自動で伏せ字にする）
  safe.js             メンション無効化・分割送信・入力の検証
  perms.js            権限の確認（サーバー管理・持ち主・付けてよいロール）
  redis.js            Upstash の接続とキー名
  config.js           サーバー設定（zod で検証）と変更履歴
  loader.js           commands/ と events/ の自動読み込み
  shutdown.js         終了時の後片付け
  dotenv-lite.js      VPS で .env を読むための最小限の読み込み
dashboard/            Web ダッシュボード（段階5）
scripts/check.js      オフラインでの確認（npm run check）
test/                 テスト（npm test）
```

## 環境変数

| 名前 | 必須 | 用途 |
|---|---|---|
| BOT_TOKEN | 必須 | ボットのトークン |
| CLIENT_ID | 必須 | アプリケーションID（数字） |
| OWNER_ID | 必須 | 持ち主のユーザーID（全サーバーで管理者扱い） |
| UPSTASH_REDIS_REST_URL | 必須 | Upstash の REST URL（https://…） |
| UPSTASH_REDIS_REST_TOKEN | 必須 | Upstash の REST トークン |
| PORT | 任意 | HTTP の待ち受け（既定 3000） |
| DEV_GUILD_ID | 任意 | テスト用サーバー。設定すると登録はそのサーバーだけ |
| DEEPL_TOKEN | 段階3から | 翻訳 |
| ANTHROPIC_API_KEY | 段階3から | AI レビュー・/ask |
| CLIENT_SECRET / OAUTH_REDIRECT_URI / SESSION_SECRET | 段階5から | ダッシュボード |

## 初回セットアップ（Replit）

1. **Developer Portal**（https://discord.com/developers/applications）
   - Bot → **Reset Token** でトークンを出し、Replit の Secrets の `BOT_TOKEN` に入れる（チャットやコードには貼らない）
   - Bot → **Privileged Gateway Intents** の **Message Content Intent** をオン（XP の文字数と翻訳に必要）。Server Members と Presence はオフのまま
   - Bot → **Public Bot** は、他の人に招待させたくなければオフ
   - Installation → **Guild Install** だけにチェック（User Install は不要）
   - General Information の **Application ID** を `CLIENT_ID` に
2. **Upstash**: Redis データベースを作り、REST の URL とトークンを Secrets に入れる
3. **OWNER_ID**: Discord の設定 → 詳細設定 → 開発者モードをオン → 自分を右クリック → 「ユーザーIDをコピー」
4. **招待 URL**（`CLIENT_ID` を自分の値に置き換える）
   ```
   https://discord.com/oauth2/authorize?client_id=CLIENT_ID&scope=bot+applications.commands&permissions=805391360
   ```
   権限: チャンネルを見る・メッセージ送信・埋め込みリンク・メッセージ履歴を読む・ロールの管理（レベルロール用）・Webhook の管理（翻訳用）。管理者権限は付けません。
   サーバーに入れたら、ボットのロールを「レベルで付けるロール」より**上**に動かしてください。
5. Replit の Shell で:
   ```bash
   npm ci
   ```
   ```bash
   npm run check
   ```
   ```bash
   npm test
   ```
   ```bash
   node deploy-commands.js --guild テスト用サーバーID
   ```
6. Run（`npm start`）を押す。コンソールに次の行が出れば成功です:
   ```
   ✅ Upstash Redis に接続しました
   🌐 HTTP 待ち受け: ポート 3000
   ✅ ボット起動: RL-C1#0000（1 サーバー）
   ```
7. UptimeRobot で、Replit の公開 URL（`/health`）を5分おきに監視する（`ok` が返る）
8. 本番では `node deploy-commands.js --global` で全体に登録し、テスト用サーバーの分は `node deploy-commands.js --clear-guild テスト用サーバーID` で消す（二重表示を防ぐ）

## 安全のための決まり

- 秘密情報は環境変数だけ。`.env` は `.gitignore` 済み。`.env.example` は空欄の見本
- `package-lock.json` はコミットする（`npm ci` で同じ版を入れるため）。Replit で作り直した lock に `registry.npmjs.org` 以外の URL が入っていたら、コミットしない
- 送信は必ず `allowedMentions: { parse: [] }`（クライアント全体の既定にもしている）
- 設定を変える操作は、毎回サーバー側で「サーバー管理」権限を確認し、変更履歴に残す
- ボットがサーバーから外れたら、そのサーバーのデータは30日後に自動で消える

## トークンが漏れたら

1. Developer Portal → Bot → **Reset Token** → Secrets を差し替えて再起動
2. Upstash → データベース → **Reset Token**（REST トークン）
3. DeepL・Anthropic のキーは各管理画面で削除して新しく発行
4. Git 履歴に入ってしまった場合は、鍵の再発行を最優先にしてください。履歴の書き換えだけでは、すでにコピーされた鍵は守れません
