import Geolocation from 'react-native-geolocation-service';
import { accelerometer, setUpdateIntervalForType, SensorTypes } from 'react-native-sensors';
import { Subscription } from 'rxjs';
import { StationaryDetector } from './utils/sensors';

export class LocationService {
  private watchId: number | null = null;
  private accelerometerSubscription: Subscription | null = null;
  private stationaryDetector: StationaryDetector;

  // GPSドリフト判定の速度閾値（m/s）
  private readonly GPS_DRIFT_SPEED_THRESHOLD = 0.3;
  // 加速度センサーのサンプリング間隔（ms）
  private readonly ACCELEROMETER_UPDATE_INTERVAL = 100; // 100ms = 10Hz

  constructor() {
    // 静止状態判定クラスのインスタンスを作成
    this.stationaryDetector = new StationaryDetector({
      historyDurationMs: 2000, // 2秒
      meanThreshold: 0.3, // 平均値の閾値（m/s²）
      stdThreshold: 0.2, // 標準偏差の閾値（m/s²）
      stationaryDurationMs: 2000, // 静止判定までの時間（2秒）
      minSampleCount: 10, // 最小サンプル数
    });
  }

  /**
   * 加速度センサーの監視を開始
   */
  private startAccelerometerWatching(): void {
    // サンプリングレートを10Hz（100ms間隔）に設定
    setUpdateIntervalForType(SensorTypes.accelerometer, this.ACCELEROMETER_UPDATE_INTERVAL);

    this.accelerometerSubscription = accelerometer.subscribe(({ x, y, z }) => {
      // StationaryDetectorで静止状態を判定
      const result = this.stationaryDetector.detectStationary(x, y, z);

      // 状態変化があった場合はログ出力
      if (result.stateChanged) {
        if (result.isStationary) {
          console.log('端末が静止状態になりました', {
            平均値: result.mean.toFixed(3),
            標準偏差: result.standardDeviation.toFixed(3),
            継続時間: `${result.duration}ms`,
          });
        } else {
          console.log('端末が動き始めました', {
            平均値: result.mean.toFixed(3),
            標準偏差: result.standardDeviation.toFixed(3),
          });
        }
      }
    });

    console.log('加速度センサーの監視を開始しました');
  }

  /**
   * 位置情報の監視を開始
   */
  startWatching(): void {
    if (this.watchId !== null) {
      console.warn('位置情報の監視は既に開始されています');
      return;
    }

    // 加速度センサーの監視を開始
    this.startAccelerometerWatching();

    this.watchId = Geolocation.watchPosition(
      position => {
        const speed = position.coords.speed ?? 0;

        console.log('位置情報取得成功:', {
          緯度: position.coords.latitude,
          経度: position.coords.longitude,
          精度: position.coords.accuracy,
          高度: position.coords.altitude,
          速度: speed,
          方角: position.coords.heading,
          タイムスタンプ: new Date(position.timestamp).toLocaleString('ja-JP'),
        });

        // GPSドリフトの検出
        if (
          this.stationaryDetector.getIsStationary() &&
          speed > this.GPS_DRIFT_SPEED_THRESHOLD
        ) {
          console.warn('⚠️ GPSドリフトを検出:', {
            状態: '静止状態',
            GPS速度: `${speed.toFixed(2)} m/s`,
            メッセージ: '端末は静止していますが、GPSが移動を検出しています',
          });
        }
      },
      error => {
        console.error('位置情報取得エラー:', error.code, error.message);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 0,
        interval: 5000,
        fastestInterval: 2000,
      },
    );

    console.log('位置情報の監視を開始しました');
  }

  /**
   * 位置情報の監視を停止
   */
  stopWatching(): void {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
      console.log('位置情報の監視を停止しました');
    }

    if (this.accelerometerSubscription) {
      this.accelerometerSubscription.unsubscribe();
      this.accelerometerSubscription = null;
      console.log('加速度センサーの監視を停止しました');
    }
  }

  /**
   * 監視中かどうかを確認
   */
  isWatching(): boolean {
    return this.watchId !== null;
  }

  /**
   * 現在静止状態かどうかを取得
   */
  getIsStationary(): boolean {
    return this.stationaryDetector.getIsStationary();
  }
}
