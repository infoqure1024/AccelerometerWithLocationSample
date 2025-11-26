/**
 * 加速度データの偏差情報
 */
export interface DeviationData {
  value: number;
  timestamp: number;
}

/**
 * 静止状態判定の結果
 */
export interface StationaryDetectionResult {
  isStationary: boolean;
  mean: number;
  standardDeviation: number;
  duration: number;
  stateChanged: boolean;
}

/**
 * 静止状態判定クラス
 * 加速度センサーのデータから端末の静止状態を判定します
 */
export class StationaryDetector {
  private deviationHistory: DeviationData[] = [];
  private isStationary: boolean = false;
  private stationaryStartTime: number | null = null;

  // 設定可能なパラメータ
  private readonly historyDurationMs: number;
  private readonly meanThreshold: number;
  private readonly stdThreshold: number;
  private readonly stationaryDurationMs: number;
  private readonly minSampleCount: number;

  /**
   * コンストラクタ
   * @param options 静止状態判定のオプション
   */
  constructor(options?: {
    historyDurationMs?: number;
    meanThreshold?: number;
    stdThreshold?: number;
    stationaryDurationMs?: number;
    minSampleCount?: number;
  }) {
    this.historyDurationMs = options?.historyDurationMs ?? 2000; // 2秒
    this.meanThreshold = options?.meanThreshold ?? 0.3; // 平均値の閾値（m/s²）
    this.stdThreshold = options?.stdThreshold ?? 0.2; // 標準偏差の閾値（m/s²）
    this.stationaryDurationMs = options?.stationaryDurationMs ?? 2000; // 静止判定までの時間（2秒）
    this.minSampleCount = options?.minSampleCount ?? 10; // 最小サンプル数
  }

  /**
   * deviation履歴に新しいデータを追加し、古いデータを削除
   */
  private addDeviationData(deviation: number): void {
    const now = Date.now();
    this.deviationHistory.push({ value: deviation, timestamp: now });

    // 古いデータを削除
    this.deviationHistory = this.deviationHistory.filter(
      data => now - data.timestamp <= this.historyDurationMs,
    );
  }

  /**
   * deviation履歴の平均値を計算
   */
  private calculateMean(): number {
    if (this.deviationHistory.length === 0) return 0;
    const sum = this.deviationHistory.reduce(
      (acc, data) => acc + data.value,
      0,
    );
    return sum / this.deviationHistory.length;
  }

  /**
   * deviation履歴の標準偏差を計算
   */
  private calculateStandardDeviation(): number {
    if (this.deviationHistory.length === 0) return 0;
    const mean = this.calculateMean();
    const squaredDiffs = this.deviationHistory.map(data =>
      Math.pow(data.value - mean, 2),
    );
    const variance =
      squaredDiffs.reduce((acc, val) => acc + val, 0) /
      this.deviationHistory.length;
    return Math.sqrt(variance);
  }

  /**
   * 加速度データから静止状態を判定
   * @param x X軸の加速度
   * @param y Y軸の加速度
   * @param z Z軸の加速度
   * @returns 静止状態判定の結果
   */
  public detectStationary(
    x: number,
    y: number,
    z: number,
  ): StationaryDetectionResult {
    // 重力加速度（約9.8 m/s²）を除外した動きの大きさを計算
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    const deviation = Math.abs(magnitude - 9.8);

    // deviation履歴に追加
    this.addDeviationData(deviation);

    const now = Date.now();
    const wasStationary = this.isStationary;
    let stateChanged = false;

    // 十分なデータが集まっている場合のみ静止状態判定を行う
    if (this.deviationHistory.length >= this.minSampleCount) {
      const mean = this.calculateMean();
      const std = this.calculateStandardDeviation();

      // 平均値と標準偏差が両方とも閾値以下の場合
      const isCurrentlyStationary =
        mean < this.meanThreshold && std < this.stdThreshold;

      if (isCurrentlyStationary) {
        // 静止状態の条件を満たしている
        if (this.stationaryStartTime === null) {
          this.stationaryStartTime = now;
        }

        // 一定時間静止状態が続いたら「静止」と判定
        const stationaryDuration = now - this.stationaryStartTime;
        if (stationaryDuration >= this.stationaryDurationMs) {
          if (!wasStationary) {
            stateChanged = true;
          }
          this.isStationary = true;
        }
      } else {
        // 静止状態の条件を満たしていない
        if (wasStationary) {
          stateChanged = true;
        }
        this.isStationary = false;
        this.stationaryStartTime = null;
      }

      const duration = this.stationaryStartTime
        ? now - this.stationaryStartTime
        : 0;

      return {
        isStationary: this.isStationary,
        mean,
        standardDeviation: std,
        duration,
        stateChanged,
      };
    }

    // データが不十分な場合
    return {
      isStationary: false,
      mean: 0,
      standardDeviation: 0,
      duration: 0,
      stateChanged: false,
    };
  }

  /**
   * 現在の静止状態を取得
   */
  public getIsStationary(): boolean {
    return this.isStationary;
  }

  /**
   * 状態をリセット
   */
  public reset(): void {
    this.deviationHistory = [];
    this.isStationary = false;
    this.stationaryStartTime = null;
  }
}
