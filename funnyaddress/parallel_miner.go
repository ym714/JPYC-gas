package main

import (
	"context"
	"encoding/hex"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"github.com/ethereum/go-ethereum/crypto"
)

// FunnyAddressChecker 面白いアドレスチェッカー
type FunnyAddressChecker struct{}

// IsFunny 面白いアドレスかどうかを判定
func (c *FunnyAddressChecker) IsFunny(address string) bool {
	return IsFunnyAddress(address)
}

// ParallelMiner 並行採掘器
type ParallelMiner struct {
	checker    *FunnyAddressChecker
	workers    int
	resultChan chan *MiningResult
	stats      *Stats
}

// MiningResult 採掘結果
type MiningResult struct {
	Address       string
	PrivateKey    string
	Attempts      int64
	WorkerID      int
	Duration      time.Duration
	TotalAttempts int64
}

// Stats 統計情報
type Stats struct {
	TotalAttempts int64
	StartTime     time.Time
	Result        *MiningResult
}

// NewParallelMiner ParallelMinerを作成
func NewParallelMiner(workers int) *ParallelMiner {
	return &ParallelMiner{
		checker:    &FunnyAddressChecker{},
		workers:    workers,
		resultChan: make(chan *MiningResult, workers),
		stats: &Stats{
			StartTime: time.Now(),
		},
	}
}

// Start 並行採掘を開始
func (pm *ParallelMiner) Start(ctx context.Context) (*MiningResult, error) {
	var wg sync.WaitGroup
	var once sync.Once

	// ワーカーを起動
	for i := 0; i < pm.workers; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()

			for {
				select {
				case <-ctx.Done():
					return
				default:
					// 1回試行する
					attempts := atomic.AddInt64(&pm.stats.TotalAttempts, 1)

					// ランダムな秘密鍵を生成
					privateKey, err := GenerateRandomPrivateKey()
					if err != nil {
						log.Printf("ワーカー%dでエラー: %v", workerID, err)
						continue
					}

					// アドレスを取得
					address := PrivateKeyToAddress(privateKey)

					// 面白いアドレスかチェック
					if pm.checker.IsFunny(address) {
						privateKeyBytes := crypto.FromECDSA(privateKey)
						privateKeyHex := hex.EncodeToString(privateKeyBytes)

						duration := time.Since(pm.stats.StartTime)

						result := &MiningResult{
							Address:       address,
							PrivateKey:    privateKeyHex,
							Attempts:      0, // このワーカーの試行回数は計算できない
							WorkerID:      workerID,
							Duration:      duration,
							TotalAttempts: attempts,
						}

						// 最初に見つけた結果のみを返す
						once.Do(func() {
							pm.resultChan <- result
							close(pm.resultChan)
						})

						return
					}
				}
			}
		}(i)
	}

	// 結果を待つ
	select {
	case result := <-pm.resultChan:
		return result, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// GetStats 統計情報を取得
func (pm *ParallelMiner) GetStats() *Stats {
	return pm.stats
}
