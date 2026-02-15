# 課金・保存設計（確定価格版）

## 前提（確定）

- 広告削除：`¥160`
- 保存拡張（広告削除込み）：`¥320`

この仕様では **買い切り2商品** を前提に、以下を設計する。

1. 課金フラグ設計
2. 無課金時の保存上限ロジック
3. 将来のカスタム展開（Custom Spread）機能の保存構造

---

## 1) 課金フラグ設計

### 1-1. 商品と権限（Entitlement）を分離する

価格・SKU（ストア商品）と、アプリ内部の権限（機能解放）を分離する。

- SKU（例）
  - `remove_ads`（¥160）
  - `save_plus`（¥320, 広告削除込み）
- Entitlement
  - `ads_removed`
  - `save_unlimited`

`save_plus` を購入したら `ads_removed` も付与する。  
つまり権限は以下の包含関係：

- `save_unlimited` ⇒ `ads_removed`

### 1-2. 最小フラグセット

ブールを増やしすぎないため、内部状態は次の2つを基本にする。

- `ent.adsRemoved: boolean`
- `ent.saveUnlimited: boolean`

導出可能な値（UI用）は getter で持つ。

- `canShowAds = !ent.adsRemoved`
- `saveLimit = ent.saveUnlimited ? Infinity : FREE_SAVE_LIMIT`

### 1-3. 互換性（既存 remove_ads の移行）

既存で `oracleforge_ads_removed = true` がある端末は起動時マイグレーションで:

- `ent.adsRemoved = true`
- `ent.saveUnlimited` は変更しない（falseのまま）

既存ユーザーの体験を壊さない。

### 1-4. 実装イメージ（疑似コード）

```ts
const FREE_SAVE_LIMIT = 3;

type EntitlementState = {
  adsRemoved: boolean;
  saveUnlimited: boolean;
  updatedAt: number;
};

function applyPurchase(productId: string, ent: EntitlementState): EntitlementState {
  if (productId === 'remove_ads') {
    ent.adsRemoved = true;
  }
  if (productId === 'save_plus') {
    ent.saveUnlimited = true;
    ent.adsRemoved = true; // 同梱特典
  }
  ent.updatedAt = Date.now();
  return ent;
}

function getSaveLimit(ent: EntitlementState): number {
  return ent.saveUnlimited ? Number.POSITIVE_INFINITY : FREE_SAVE_LIMIT;
}
```

---

## 2) 無課金時の保存上限ロジック

### 2-1. 上限の定義

- 無課金：`3件`
- `remove_ads`のみ：`3件`（保存拡張は含まない）
- `save_plus`：`無制限`

### 2-2. 何を保存対象にするか

「保存上限」は結果履歴（reading result）に適用する。  
設定値・カード倉庫・デッキ定義などのシステムデータには適用しない。

### 2-3. 上限到達時の挙動（推奨）

#### 推奨フローA（UX重視）

- 4件目を保存しようとした時、モーダル表示：
  - 「保存上限（3件）に達しました」
  - CTA1: 「保存拡張を購入（¥320）」
  - CTA2: 「最古を削除して保存」
  - CTA3: 「キャンセル」

#### 代替フローB（実装簡易）

- 自動で最古を削除し常に最新3件を保持（通知のみ）

> 課金導線を作るならフローAが適切。

### 2-4. 判定タイミング

保存ボタン押下時に毎回判定する（画面描画時に一度だけ判定しない）。

```ts
function canSaveNewEntry(currentCount: number, ent: EntitlementState): boolean {
  if (ent.saveUnlimited) return true;
  return currentCount < FREE_SAVE_LIMIT;
}
```

### 2-5. 復元・再インストール時

- `restorePurchases()` 後に entitlements を再計算
- 再計算結果で UI（広告表示／保存導線）を即時再描画

---

## 3) 将来のカスタム展開機能の保存構造

カスタム展開（ユーザー定義スプレッド）を入れても破綻しないよう、  
**「展開定義」と「占い結果」を分離**して保存する。

### 3-1. テーブル（またはStore）構成

IndexedDB を想定。

#### A. `spread_definitions`（展開テンプレート）

```ts
type SpreadDefinition = {
  id: string;                 // UUID
  kind: 'preset' | 'custom';
  name: string;
  cardCount: number;
  positions: Array<{
    key: string;              // '1', '2', 'center' など
    x: number;                // 正規化座標 0..1
    y: number;                // 正規化座標 0..1
    angle?: number;           // 任意
    labelJa?: string;
    labelEn?: string;
  }>;
  version: number;            // 定義更新用
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
};
```

#### B. `reading_results`（保存結果）

```ts
type ReadingResult = {
  id: string;                 // UUID
  spreadId: string;           // spread_definitions.id
  spreadVersion: number;      // 保存時の定義バージョンを固定
  question?: string;
  cards: Array<{
    cardId: string;
    positionKey: string;
    reversed?: boolean;
    isSignificator?: boolean;
  }>;
  memo?: string;
  createdAt: number;
  updatedAt: number;
};
```

#### C. `app_entitlements`（課金権限）

```ts
type AppEntitlements = {
  id: 'current';
  adsRemoved: boolean;
  saveUnlimited: boolean;
  source: 'local' | 'store-verified';
  updatedAt: number;
};
```

### 3-2. この分離の利点

- 展開定義を編集しても、過去結果は `spreadVersion` で再現可能
- 「プリセット展開」「カスタム展開」を同一UIで扱える
- 保存上限判定は `reading_results` 件数だけ見ればよく単純

### 3-3. 保存上限との接続

上限対象は `reading_results` のみ。

- `count(reading_results)` を取得
- `ent.saveUnlimited === false && count >= 3` なら課金導線モーダル

`spread_definitions` は課金有無に関係なく保存可能（将来仕様変更しやすい）。

---

## 4) 実装順（最短）

1. SKU追加：`save_plus` をストア登録
2. Entitlement永続化を追加（`adsRemoved`, `saveUnlimited`）
3. 購入イベントの付与ロジック実装（`save_plus` ⇒ 両方true）
4. 保存処理に上限判定を追加（無課金3件）
5. 上限到達モーダルに `¥320` 導線を追加
6. 将来のカスタム展開向けに `spread_definitions` と `reading_results` を分離

---

## 5) 価格表示の文言（アプリ内）

- 広告削除：`¥160`
- 保存拡張（広告削除込み）：`¥320`

`save_plus` の説明には必ず「広告削除込み」を明記して、二重購入懸念を防ぐ。
