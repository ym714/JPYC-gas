package main

import (
	"crypto/ecdsa"
	"encoding/hex"
	"fmt"

	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/crypto"
)

// AddressGenerator アドレス生成器
type AddressGenerator struct {
	checker *FunnyAddressChecker
}

// NewAddressGenerator AddressGeneratorを作成
func NewAddressGenerator(checker *FunnyAddressChecker) *AddressGenerator {
	return &AddressGenerator{
		checker: checker,
	}
}

// GenerateRandomPrivateKey ランダムな秘密鍵を生成
func GenerateRandomPrivateKey() (*ecdsa.PrivateKey, error) {
	return crypto.GenerateKey()
}

// PrivateKeyToAddress 秘密鍵からアドレスを生成
func PrivateKeyToAddress(privateKey *ecdsa.PrivateKey) string {
	publicKey := privateKey.Public()
	publicKeyECDSA, ok := publicKey.(*ecdsa.PublicKey)
	if !ok {
		return ""
	}
	address := crypto.PubkeyToAddress(*publicKeyECDSA)
	return address.Hex()
}

// MineFunnyAddress 面白いアドレスを探索
func (ag *AddressGenerator) MineFunnyAddress() (string, string, int64, error) {
	var attempts int64
	for {
		attempts++

		// ランダムな秘密鍵を生成
		privateKey, err := GenerateRandomPrivateKey()
		if err != nil {
			return "", "", attempts, fmt.Errorf("秘密鍵の生成に失敗: %w", err)
		}

		// アドレスを取得
		address := PrivateKeyToAddress(privateKey)

		// 面白いアドレスかチェック
		if ag.checker.IsFunny(address) {
			privateKeyBytes := crypto.FromECDSA(privateKey)
			privateKeyHex := hex.EncodeToString(privateKeyBytes)
			return address, privateKeyHex, attempts, nil
		}
	}
}

// GetAccounts 秘密鍵からAccountsアカウントを取得
func GetAccounts(privateKeyHex string) (*accounts.Account, error) {
	privateKeyBytes, err := hex.DecodeString(privateKeyHex)
	if err != nil {
		return nil, fmt.Errorf("秘密鍵のデコードに失敗: %w", err)
	}

	privateKey, err := crypto.ToECDSA(privateKeyBytes)
	if err != nil {
		return nil, fmt.Errorf("ECDSAへの変換に失敗: %w", err)
	}

	return &accounts.Account{
		Address: crypto.PubkeyToAddress(privateKey.PublicKey),
	}, nil
}
