/*******************************************************************************
Copyright (C), 2017, 
文 件 名: WechatPlatformManager.js
作    者: lyn
创建日期: 2018-03-19
完成日期: 
功能描述: 
其它相关: 
修改记录: 
*******************************************************************************/

// 日志文件名
var LOG_FILE_NAME = 'WechatPlatformManager.js.log'
    
var BaseManager = require("BaseManager")

var APP_ID     = "wxac6228496497182c"
var APP_SECRET = "c7e65d1bea905fbc8a1db42df33a691c"

var ANDROID_CLASS_NAME = "org/cocos/unkchess/wxapi/WXEntryActivity"
var JAVA_STRING        = "Ljava/lang/String;"
var TOKEN_CODE_URL     = "https://api.weixin.qq.com/sns/oauth2/access_token?appid=%s&secret=%s&code=%s&grant_type=authorization_code"
var USER_INFO_URL      = "https://api.weixin.qq.com/sns/userinfo?access_token=%s&openid=%s"
var REFRESH_TOKEN_URL  = "https://api.weixin.qq.com/sns/oauth2/refresh_token?appid=%s&grant_type=refresh_token&refresh_token=%s"

var MessageManager = cc.Class({
    extends: BaseManager,
    ctor: function() {
        this.m_headList = {}
    },

    init: function (msg) {
        this.RegisterAppID(APP_ID)
    },

    wechatLogin:function(){
        // 检测微信是否安装
        var _bInstall = this.CheckWXInstalled()
        if(_bInstall){
            // 微信认证，认证后的refresh_token拥有较长的有效期（30天）可以不用每次认证把refresh_token保存在本地都可以
            var _refresh_token = this.getRefreshToken()
            if(!_refresh_token || _refresh_token == "")
            {
                this.SendAuthRequest()
            } else {
               this.RefreshAccessToken(_refresh_token)
            }
        } else {
            cc.log("微信客户端没有安卓，请安装再试。")
        }
    },

    // 注册appid
    RegisterAppID:function(app_id){
        var _methond_name = "RegisterAppID"
        var _methond_singnature = "(" + JAVA_STRING +")V"
        jsb.reflection.callStaticMethod(ANDROID_CLASS_NAME, _methond_name, _methond_singnature, app_id)
    },

    // 打开微信应用
    OpenWXApp:function(){
        var _methond_name = "OpenWXApp"
        var _methond_singnature = "(" +")V"
        jsb.reflection.callStaticMethod(ANDROID_CLASS_NAME, _methond_name, _methond_singnature)
    },

    // 检查微信是否安装
    CheckWXInstalled:function(){
        var _methond_name = "CheckWXInstalled"
        var _methond_singnature = "(" +")Z"
        return jsb.reflection.callStaticMethod(ANDROID_CLASS_NAME, _methond_name, _methond_singnature)
    },

    // 这里是微信认证，认证在底层成功后，会返回一个token_code，(这是需要js被java端调用来返回【setAccessTokenCode】)用这个token_code去请求access_token
    // 请求成功会收到：refresh_token，用这个去获取微信用户的信息
    SendAuthRequest:function(){
        var _user_info = "snsapi_userinfo"
        var _req_flag  = "wechat_sdk_demo_test"
        var _methond_name = "SendAuthRequest"
        var _methond_singnature = "(" + JAVA_STRING + JAVA_STRING +")V";
        jsb.reflection.callStaticMethod(ANDROID_CLASS_NAME, _methond_name, _methond_singnature, _user_info, _req_flag)
    },

    wechatOnRespone:function(_code){
        this.Log("wechatOnRespone")
    	this.setAccessTokenCode(_code)
        this.m_code = _code
    },

    getCode:function(){
        return this.m_code
    },

    getWechatInfo:function(){
        return this.m_wechatInfo
    },

    // 刷新access_token ， 每次登录的时候去刷新一次token
    RefreshAccessToken:function(refresh_token){
        var self = this
        this.Log("RefreshAccessToken"+refresh_token)
        this.saveRefreshToken(refresh_token)
        var _callback = function(data){
            // 刷型token 后的处理
            self.Log("RefreshAccessToken _callback: " + data)
            var refresh_data = JSON.parse(data)
            if(refresh_data.errcode){
                self.Log("RefreshAccessToken 微信授权过期！errcode:" + json_data.errcode)
                //刷新超时后，则重新授权
               self.SendAuthRequest()
            } else {
                //refresh_token拥有较长的有效期（30天），当refresh_token失效的后，需要用户重新授权，
                //所以，请开发者在refresh_token即将过期时（如第29天时），进行定时的自动刷新并保存好它。
                //记录下app_id, access_token, refresh_token
                self.Log("RefreshAccessToken GetUserInfo")
                self.GetUserInfo(refresh_data.access_token, refresh_data.openid)
            }
        }
        var url = cc.js.formatStr(REFRESH_TOKEN_URL, APP_ID, refresh_token)
        this.SendHttpRequest(url, _callback, "RefreshAccessToken")
    },

    // 获取用户信息
    // @access_token token标记
   	// @open_id 
    GetUserInfo:function(access_token, open_id){
        this.Log("GetUserInfo " + access_token + "  " + open_id)
        var self = this
        var _callback = function(data){
            self.Log("GetUserInfo _callback")
            // 处理登录
	        var resp_data = data
	        resp_data = resp_data.replace(/\\/, "")
	        var user_info_data = JSON.parse(resp_data)
            self.m_wechatInfo = user_info_data
           
            cc.eventManager.dispatchCustomEvent("WechatOnRespone")
	        //微信登录只需要向服务器发送openid即可，服务器会根据当前的情况来登录或者创建账号
	 /*     LoginData.openid = user_info_data.openid
	        LoginData.headerUrl = user_info_data.headimgurl
	        LoginData.nickName  = user_info_data.nickname
	        LoginData.sex       = user_info_data.sex - 1
            */

	        cc.log("微信授权成功！向服务器请求登录")

        }
        var url = cc.js.formatStr(USER_INFO_URL, access_token, open_id)
        this.SendHttpRequest(url, _callback, "GetUserInfo")
    },

    // android java & ios oc 调用这个函数设置code
    // @code token code
    // 调用格式：Cocos2dxJavascriptJavaBridge.evalString("cc.Client.WechatPlatformManager.setAccessTokenCode("+code+");");
    setAccessTokenCode:function(code){
        this.Log("setAccessTokenCode:" + code)
        // 调用获取token
        this.GetAccessTokenByCode(code)
    },

    // SendAuthRequest返回后的code去获取token
    // @code token code
    GetAccessTokenByCode:function(code){
        this.Log("GetAccessTokenByCode" + code)
        var self = this
        var _callback = function(data){
            // 微信获取access_token后返回处理登录
            var json_data = JSON.parse(data)
            if(json_data.errcode){
                // 弹出错误提示
                cc.log("登录失败! error code", )
            } else {
                //access_token是调用授权关系接口的调用凭证，由于access_token有效期（目前为2个小时）较短，所以登录后，立即刷新
                self.RefreshAccessToken(json_data.refresh_token)
            }
        }
        var url = cc.js.formatStr(TOKEN_CODE_URL, APP_ID, APP_SECRET, code)
        this.SendHttpRequest(url, _callback, "GetAccessTokenByCode")
    },

    // 分享到好友聊天
    // @share_link 分享链接
    // @title 标题
    // @desc 分享内容
    ShareToFriend:function(share_link, title, desc){
    	var _type = 1 // 1:聊天分享  2:朋友圈分享
        var _methond_name = "ShareLinkToWeChat"
        var _methond_singnature = "(" + JAVA_STRING + JAVA_STRING +")V";
        jsb.reflection.callStaticMethod(ANDROID_CLASS_NAME, _methond_name, _methond_singnature, share_link, title, desc, _type)
    },

    // 分享到朋友圈
    // @share_link 分享链接
    // @title 标题
    // @desc 分享内容
    ShareToFriendCircle:function(share_link, title, desc){
    	var _type = 2 // 1:聊天分享  2:朋友圈分享
        var _methond_name = "ShareLinkToWeChat"
        var _methond_singnature = "(" + JAVA_STRING + JAVA_STRING +")V";
        jsb.reflection.callStaticMethod(ANDROID_CLASS_NAME, _methond_name, _methond_singnature, share_link, title, desc, _type)
    },

    // 获取微信头像
    // @tag 节点的唯一标记，下载成后add到tag标记的节点
    // @url 头像路径
    // @sex 性别标记，如果下载失败使用默认的男女头像
    getWechatImageByUrl:function(tag, url, sex)
    {
       cc.loader.load({url:url,type:"png"},function (err,tex) {
            if(err){
                cc.log("load wechat image faild url ："+url);
            }
            if(tex){
            	var _sprite = new cc.Sprite()
                var _spriteFrame = new cc.SpriteFrame(tex);
                if(_spriteFrame){
                	_sprite.spriteFrame = _spriteFrame
                	// 发送事件
                }
            }
        });
    },

    // http请求
    // @url 请求地址
    // @callback 回调
    SendHttpRequest:function(url, callback, tag){
    	this.Log("SendHttpRequest: " + (tag || "untag") + "  " + url)
        var self = this
        var _callback = callback
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4 && (xhr.status >= 200 && xhr.status < 400)) {
                var response = xhr.responseText
                if(_callback){
                    self.Log("_callback response:" + response +"   " + tag)
                    _callback(response)
                }
            }
        }
        xhr.open("GET", url, true)
        xhr.send()
    },

    // 获取默认男头像
    getDefaultBoyHead:function(){
    	return new cc.Sprite()
    },

    // 获取默认女头像
    getDefaultGrilHead:function(){
    	return new cc.Sprite()
    },

    saveRefreshToken: function(refresh_token){
        // 序列化数据 
        var serData = JSON.stringify(refresh_token)

        // 保存数据
        cc.sys.localStorage.setItem("wechat_refresh_token", serData);
    },

    getRefreshToken: function(){
        // 获取本地数据
        var localData = cc.sys.localStorage.getItem("wechat_refresh_token")
        if (localData) {
            // 反序列化数据
            return JSON.parse(localData);
        } else{
            cc.log("获取微信refresh_token失败")
        }
        return ""
    },

    // 调用android的log
    Log:function(str){
        var _methond_name = "TestCall"
        var _methond_singnature = "(" + JAVA_STRING +")V";
        jsb.reflection.callStaticMethod("org/cocos2dx/javascript/AppActivity", _methond_name, _methond_singnature, str)
    },
})