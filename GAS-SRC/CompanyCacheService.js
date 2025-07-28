/**
 * 会社情報のキャッシュ管理サービス
 * スプレッドシートアクセスを削減し、パフォーマンスを向上させるためのキャッシュ層
 */
class CompanyCacheService {
  constructor() {
    this.cache = CacheService.getScriptCache();
    this.CACHE_KEYS = {
      COMPANIES: 'companies_list',
      COMPANY_PREFIX: 'company_',
      PATIENT_NAMES: 'patient_names_light',
      EXPIRY_TIME: 1800 // 30分（秒単位）
    };
  }

  /**
   * 会社一覧をキャッシュから取得
   */
  getCachedCompanies() {
    try {
      const cached = this.cache.get(this.CACHE_KEYS.COMPANIES);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error('キャッシュ読み込みエラー:', error);
    }
    return null;
  }

  /**
   * 会社一覧をキャッシュに保存
   */
  setCachedCompanies(companies) {
    try {
      const data = JSON.stringify(companies);
      // キャッシュサイズ制限（100KB）を超える場合は保存しない
      if (data.length > 100000) {
        console.warn('キャッシュサイズが大きすぎるため、保存をスキップします');
        return;
      }
      this.cache.put(this.CACHE_KEYS.COMPANIES, data, this.CACHE_KEYS.EXPIRY_TIME);
    } catch (error) {
      console.error('キャッシュ保存エラー:', error);
    }
  }

  /**
   * 特定の会社情報をキャッシュから取得
   */
  getCachedCompany(companyId) {
    try {
      const cached = this.cache.get(this.CACHE_KEYS.COMPANY_PREFIX + companyId);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error('会社情報キャッシュ読み込みエラー:', error);
    }
    return null;
  }

  /**
   * 特定の会社情報をキャッシュに保存
   */
  setCachedCompany(companyId, companyData) {
    try {
      const data = JSON.stringify(companyData);
      this.cache.put(
        this.CACHE_KEYS.COMPANY_PREFIX + companyId,
        data,
        this.CACHE_KEYS.EXPIRY_TIME
      );
    } catch (error) {
      console.error('会社情報キャッシュ保存エラー:', error);
    }
  }

  /**
   * 患者名の軽量キャッシュを取得
   */
  getCachedPatientNames() {
    try {
      const cached = this.cache.get(this.CACHE_KEYS.PATIENT_NAMES);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error('患者名キャッシュ読み込みエラー:', error);
    }
    return null;
  }

  /**
   * 患者名の軽量キャッシュを保存（ID、名前、カナのみ）
   */
  setCachedPatientNames(patients) {
    try {
      // 必要最小限のデータのみ抽出
      const lightData = patients.map(patient => ({
        id: patient.id || patient[0],
        name: patient.name || patient[1],
        kana: patient.kana || patient[2]
      }));
      
      const data = JSON.stringify(lightData);
      // キャッシュサイズ制限を考慮
      if (data.length > 100000) {
        console.warn('患者名キャッシュサイズが大きすぎるため、保存をスキップします');
        return;
      }
      
      this.cache.put(this.CACHE_KEYS.PATIENT_NAMES, data, this.CACHE_KEYS.EXPIRY_TIME);
    } catch (error) {
      console.error('患者名キャッシュ保存エラー:', error);
    }
  }

  /**
   * 会社関連のキャッシュを無効化
   */
  invalidateCompaniesCache() {
    try {
      this.cache.remove(this.CACHE_KEYS.COMPANIES);
      // 個別の会社キャッシュも削除
      this._removeCompanyPrefixedKeys();
    } catch (error) {
      console.error('キャッシュ無効化エラー:', error);
    }
  }

  /**
   * 特定の会社のキャッシュを無効化
   */
  invalidateCompanyCache(companyId) {
    try {
      this.cache.remove(this.CACHE_KEYS.COMPANY_PREFIX + companyId);
      // 会社一覧も無効化（整合性のため）
      this.cache.remove(this.CACHE_KEYS.COMPANIES);
    } catch (error) {
      console.error('会社キャッシュ無効化エラー:', error);
    }
  }

  /**
   * 患者名キャッシュを無効化
   */
  invalidatePatientNamesCache() {
    try {
      this.cache.remove(this.CACHE_KEYS.PATIENT_NAMES);
    } catch (error) {
      console.error('患者名キャッシュ無効化エラー:', error);
    }
  }

  /**
   * すべてのキャッシュをクリア
   */
  clearAllCache() {
    try {
      this.cache.removeAll([
        this.CACHE_KEYS.COMPANIES,
        this.CACHE_KEYS.PATIENT_NAMES
      ]);
      this._removeCompanyPrefixedKeys();
    } catch (error) {
      console.error('全キャッシュクリアエラー:', error);
    }
  }

  /**
   * 会社プレフィックスのキーを削除（プライベートメソッド）
   */
  _removeCompanyPrefixedKeys() {
    // GASのCache Serviceでは個別のプレフィックスキーの一括削除は
    // 直接サポートされていないため、実装上の制限として
    // 会社一覧キャッシュの無効化で代替
  }

  /**
   * キャッシュヒット率を計測（デバッグ用）
   */
  logCacheHit(key, hit) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] Cache ${hit ? 'HIT' : 'MISS'}: ${key}`;
    console.log(logEntry);
  }
}

// グローバルインスタンスの作成
const companyCacheService = new CompanyCacheService();