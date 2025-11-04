// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title JPYD Token
/// @notice テストネット用のERC20トークン（JPYD）
/// @dev OpenZeppelinのERC20をベースにした実装
contract JPYD {
    // ERC20の標準的な状態変数
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    // オーナーアドレス
    address public owner;

    // マッピング
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // イベント
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "JPYD: caller is not the owner");
        _;
    }

    /// @notice コンストラクタ
    /// @param _name トークン名
    /// @param _symbol トークンシンボル
    /// @param _initialSupply 初期供給量
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply
    ) {
        name = _name;
        symbol = _symbol;
        owner = msg.sender;
        totalSupply = _initialSupply * 10**decimals;
        balanceOf[msg.sender] = totalSupply;
        emit Transfer(address(0), msg.sender, totalSupply);
    }

    /// @notice トークンを転送
    /// @param _to 受信者アドレス
    /// @param _value 転送量
    function transfer(address _to, uint256 _value) public returns (bool) {
        require(_to != address(0), "JPYD: transfer to the zero address");
        require(balanceOf[msg.sender] >= _value, "JPYD: insufficient balance");

        balanceOf[msg.sender] -= _value;
        balanceOf[_to] += _value;

        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    /// @notice トークンを転送（fromアドレスから）
    /// @param _from 送信者アドレス
    /// @param _to 受信者アドレス
    /// @param _value 転送量
    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) public returns (bool) {
        require(_to != address(0), "JPYD: transfer to the zero address");
        require(balanceOf[_from] >= _value, "JPYD: insufficient balance");
        require(
            allowance[_from][msg.sender] >= _value,
            "JPYD: insufficient allowance"
        );

        balanceOf[_from] -= _value;
        balanceOf[_to] += _value;
        allowance[_from][msg.sender] -= _value;

        emit Transfer(_from, _to, _value);
        return true;
    }

    /// @notice スパンダーに許可量を設定
    /// @param _spender スパンダーアドレス
    /// @param _value 許可量
    function approve(address _spender, uint256 _value) public returns (bool) {
        require(_spender != address(0), "JPYD: approve to the zero address");

        allowance[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    /// @notice 追加のトークンを発行（オーナーのみ）
    /// @param _to 受信者アドレス
    /// @param _amount 発行量
    function mint(address _to, uint256 _amount) public onlyOwner {
        require(_to != address(0), "JPYD: mint to the zero address");

        totalSupply += _amount;
        balanceOf[_to] += _amount;

        emit Transfer(address(0), _to, _amount);
    }

    /// @notice トークンを焼却
    /// @param _amount 焼却量
    function burn(uint256 _amount) public {
        require(balanceOf[msg.sender] >= _amount, "JPYD: insufficient balance");

        balanceOf[msg.sender] -= _amount;
        totalSupply -= _amount;

        emit Transfer(msg.sender, address(0), _amount);
    }

    /// @notice オーナーを変更（オーナーのみ）
    /// @param _newOwner 新しいオーナーアドレス
    function transferOwnership(address _newOwner) public onlyOwner {
        require(_newOwner != address(0), "JPYD: new owner is the zero address");

        address oldOwner = owner;
        owner = _newOwner;

        emit OwnershipTransferred(oldOwner, _newOwner);
    }
}

