// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice ERC20トークンインターフェース
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}

/// @title 広告オークションコントラクト
/// @notice 現在の広告枠の金額よりも100高い金額で入札された場合、その広告枠が表示される
/// @notice 入札で受け取ったERC20トークンはすぐに指定アドレスに送金される
contract AdAuction {
    
    struct Advertisement {
        address bidder;
        uint256 bidAmount;
        string imageUrl;
        string altText;
        string hrefUrl;
        uint256 timestamp;
    }

    // 現在の広告
    Advertisement public currentAd;
    
    // 最小入札増加額（100トークン単位）
    // ERC20トークンのdecimalsに応じて動的に計算される
    // 例: JPYD（decimals=18）の場合、100トークン = 100 * 10^18
    uint256 public constant MIN_BID_INCREMENT_TOKENS = 100;
    
    // オーナーアドレス
    address public owner;
    
    // ERC20トークンアドレス（ownerが設定可能）
    address public erc20TokenAddress;
    
    // イベント
    event AdBidPlaced(
        address indexed bidder,
        uint256 bidAmount,
        string imageUrl,
        string altText,
        string hrefUrl
    );
    
    event AdReplaced(
        address indexed oldBidder,
        address indexed newBidder,
        uint256 oldAmount,
        uint256 newAmount
    );

    event FundsTransferred(
        address indexed to,
        uint256 amount
    );



    constructor(
        address _erc20TokenAddress,
        string memory _initialImageUrl,
        string memory _initialAltText,
        string memory _initialHrefUrl
    ) {
        owner = msg.sender;
        erc20TokenAddress = _erc20TokenAddress; // コンストラクタでERC20トークンアドレスを設定
        
        // 初期広告データを設定
        require(bytes(_initialImageUrl).length > 0, "Initial image URL cannot be empty");
        require(bytes(_initialAltText).length > 0, "Initial alt text cannot be empty");
        require(bytes(_initialHrefUrl).length > 0, "Initial href URL cannot be empty");
        
        currentAd = Advertisement({
            bidder: address(0),
            bidAmount: 0,
            imageUrl: _initialImageUrl,
            altText: _initialAltText,
            hrefUrl: _initialHrefUrl,
            timestamp: block.timestamp
        });
    }

    /// @notice 広告に入札する（ERC20トークンを使用）
    /// @param imageUrl 広告画像のURL
    /// @param altText 画像のaltテキスト
    /// @param hrefUrl クリック時の遷移先URL
    /// @param bidAmount 入札額（ERC20トークンの最小単位）
    /// @dev 現在の入札額よりも100以上高い金額で入札する必要がある
    /// @dev ERC20トークンの最小単位で100 = 100 * 10^decimals（例: JPYDなら100 * 10^18）
    /// @dev 入札で受け取ったトークンはすぐにownerに送金される
    function placeBid(
        string memory imageUrl,
        string memory altText,
        string memory hrefUrl,
        uint256 bidAmount
    ) public {
        require(erc20TokenAddress != address(0), "ERC20 token address not set");
        require(bytes(imageUrl).length > 0, "Image URL cannot be empty");
        require(bytes(altText).length > 0, "Alt text cannot be empty");
        require(bytes(hrefUrl).length > 0, "Href URL cannot be empty");
        
        uint256 minIncrement = MIN_BID_INCREMENT_TOKENS * 10 ** getTokenDecimals();
        uint256 requiredBid = currentAd.bidAmount + minIncrement;
        require(bidAmount >= requiredBid, "Bid must be at least 100 token units higher than current bid");
        require(bidAmount >= minIncrement, "Bid amount must be at least 100 token units");
        
        // ERC20トークンをコントラクトに転送
        IERC20 token = IERC20(erc20TokenAddress);
        require(token.transferFrom(msg.sender, address(this), bidAmount), "Token transfer failed");
        
        // 前の入札者情報を保存
        address oldBidder = currentAd.bidder;
        uint256 oldAmount = currentAd.bidAmount;
        
        // 新しい広告を設定（コントラクト内にキーバリューとして保持）
        currentAd = Advertisement({
            bidder: msg.sender,
            bidAmount: bidAmount,
            imageUrl: imageUrl,
            altText: altText,
            hrefUrl: hrefUrl,
            timestamp: block.timestamp
        });
        
        // 受け取ったトークンをすぐにownerに送金
        require(token.transfer(owner, bidAmount), "Owner transfer failed");
        
        emit FundsTransferred(owner, bidAmount);
        emit AdBidPlaced(msg.sender, bidAmount, imageUrl, altText, hrefUrl);
        
        if (oldBidder != address(0)) {
            emit AdReplaced(oldBidder, msg.sender, oldAmount, bidAmount);
        }
    }
    
    /// @notice ERC20トークンのシンボルを取得
    function getTokenSymbol() public view returns (string memory) {
        if (erc20TokenAddress == address(0)) {
            return "POL";
        }
        IERC20 token = IERC20(erc20TokenAddress);
        return token.symbol();
    }
    
    /// @notice ERC20トークンのdecimalsを取得
    function getTokenDecimals() public view returns (uint8) {
        if (erc20TokenAddress == address(0)) {
            return 18;
        }
        IERC20 token = IERC20(erc20TokenAddress);
        return token.decimals();
    }

    /// @notice 現在の広告情報を取得
    /// @return bidder 現在の入札者アドレス
    /// @return bidAmount 現在の入札額
    /// @return imageUrl 広告画像のURL
    /// @return altText 画像のaltテキスト
    /// @return hrefUrl クリック時の遷移先URL
    /// @return timestamp 広告が設定されたタイムスタンプ
    function getCurrentAd() public view returns (
        address bidder,
        uint256 bidAmount,
        string memory imageUrl,
        string memory altText,
        string memory hrefUrl,
        uint256 timestamp
    ) {
        return (
            currentAd.bidder,
            currentAd.bidAmount,
            currentAd.imageUrl,
            currentAd.altText,
            currentAd.hrefUrl,
            currentAd.timestamp
        );
    }

    /// @notice 次の入札に必要な最小金額を取得
    /// @return 最小入札金額（トークンの最小単位）
    function getMinBidAmount() public view returns (uint256) {
        uint256 minIncrement = MIN_BID_INCREMENT_TOKENS * 10 ** getTokenDecimals();
        return currentAd.bidAmount + minIncrement;
    }

    /// @notice コントラクトの残高を取得（通常は0になるはず）
    /// @dev 入札金額はすぐに送金されるため、残高は通常0
    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    /// @notice 送金先アドレスを取得（owner）
    function getDonationAddress() public view returns (address) {
        return owner;
    }

    /// @notice ERC20トークンアドレスを取得
    function getERC20TokenAddress() public view returns (address) {
        return erc20TokenAddress;
    }
}

