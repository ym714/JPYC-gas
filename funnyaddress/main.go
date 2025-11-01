package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	// コマンドライン引数
	var workers = flag.Int("workers", 4, "並行ワーカー数")
	flag.Parse()

	fmt.Println("=== 面白いアドレス採掘ツール ===")
	fmt.Printf("並行ワーカー数: %d\n\n", *workers)

	// Ctrl+Cのハンドリング
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// 別ゴルーチンでCtrl+Cを待機
	go func() {
		<-sigChan
		fmt.Println("\n\n中断されました。")
		cancel()
	}()

	// 並行採掘器を作成
	miner := NewParallelMiner(*workers)

	// 進捗表示用のタイマー
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	go func() {
		for {
			select {
			case <-ticker.C:
				stats := miner.GetStats()
				attempts := stats.TotalAttempts
				duration := time.Since(stats.StartTime)

				if duration.Seconds() > 0 {
					speed := float64(attempts) / duration.Seconds()
					fmt.Printf("試行回数: %d (%.2f 回/秒)\r", attempts, speed)
				}
			case <-ctx.Done():
				return
			}
		}
	}()

	// 採掘開始
	startTime := time.Now()
	result, err := miner.Start(ctx)

	// 統計情報を取得
	stats := miner.GetStats()
	duration := time.Since(startTime)
	totalAttempts := stats.TotalAttempts

	if err != nil {
		// Ctrl+Cで中断された場合は通常の終了として扱う
		if err == context.Canceled {
			fmt.Println("\n\n=== 採掘中断 ===")
			fmt.Printf("総試行回数: %d\n", totalAttempts)
			fmt.Printf("所要時間: %v\n", duration)
			if duration.Seconds() > 0 {
				speed := float64(totalAttempts) / duration.Seconds()
				fmt.Printf("採掘速度: %.2f 回/秒\n", speed)
			}
			return
		}
		log.Fatalf("採掘エラー: %v", err)
	}

	if result == nil {
		fmt.Println("\n\n=== 採掘中断 ===")
		fmt.Printf("総試行回数: %d\n", totalAttempts)
		fmt.Printf("所要時間: %v\n", duration)
		if duration.Seconds() > 0 {
			speed := float64(totalAttempts) / duration.Seconds()
			fmt.Printf("採掘速度: %.2f 回/秒\n", speed)
		}
		return
	}

	// 結果表示
	fmt.Println("\n\n=== 採掘成功！ ===")
	fmt.Printf("面白いアドレス: %s\n", result.Address)
	fmt.Printf("秘密鍵: %s\n", result.PrivateKey)
	fmt.Printf("ワーカーID: %d\n", result.WorkerID)
	fmt.Printf("総試行回数: %d\n", result.TotalAttempts)
	fmt.Printf("所要時間: %v\n", duration)

	if duration.Seconds() > 0 {
		speed := float64(result.TotalAttempts) / duration.Seconds()
		fmt.Printf("採掘速度: %.2f 回/秒\n", speed)
	}

	fmt.Println("\n警告: この秘密鍵は本番環境では使用しないでください！")
}
