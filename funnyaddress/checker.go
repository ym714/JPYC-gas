package main

// IsFunnyAddress アドレスが面白いかを判定する関数
func IsFunnyAddress(address string) bool {
	// 最初が0xE7C3から始まって、3c29で終わるかをチェック
	if len(address) < 6 {
		return false
	}
	return address[:6] == "0xE7C3" && address[len(address)-4:] == "3c29"
}
