window.payment = (function() {
    
    /**
     * 发起支付
     * @param {number} orderId - 订单ID
     * @param {string} method - 支付方式: 'wechat' | 'alipay' 
     * @returns {Promise}
     */
    async function initiatePayment(orderId, method = 'wechat') {
        try {
            const endpoint = method === 'wechat' ? '/api/payment/wechat/' : '/api/payment/alipay/';
            
            const res = await window.api.fetchAPI(endpoint, {
                method: 'POST',
                body: { order_id: orderId }
            });
            
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || '支付请求失败');
            }
            
            const paymentData = await res.json();
            
            if (method === 'wechat') {
                return await processWeChatPay(paymentData.pay_params, orderId);
            } else {
                return await processAlipay(paymentData.pay_params, orderId);
            }
            
        } catch (error) {
            throw new Error(`支付失败: ${error.message}`);
        }
    }
    
    /**
     * 处理微信支付
     */
    async function processWeChatPay(payParams, orderId) {
        return new Promise((resolve, reject) => {
            // 检查是否在微信环境
            if (typeof WeixinJSBridge === 'undefined') {
                // 非微信环境，显示二维码或引导
                showPaymentQRCode(payParams, orderId, 'wechat');
                resolve({ success: true, method: 'qr_code' });
                return;
            }
            
            // 微信内支付
            WeixinJSBridge.invoke('getBrandWCPayRequest', {
                appId: payParams.appId,
                timeStamp: payParams.timeStamp,
                nonceStr: payParams.nonceStr,
                package: payParams.package,
                signType: payParams.signType,
                paySign: payParams.paySign
            }, function(res) {
                if (res.err_msg === "get_brand_wcpay_request:ok") {
                    resolve({ success: true, method: 'wechat_jsapi' });
                } else {
                    reject(new Error('微信支付失败'));
                }
            });
        });
    }
    
    /**
     * 处理支付宝支付
     */
    async function processAlipay(payParams, orderId) {
        return new Promise((resolve, reject) => {
            // 检查是否有支付宝客户端
            if (typeof AlipayJSBridge !== 'undefined') {
                // 支付宝内支付
                AlipayJSBridge.call('tradePay', {
                    orderStr: payParams.orderString
                }, function(result) {
                    if (result.resultCode === '9000') {
                        resolve({ success: true, method: 'alipay_jsapi' });
                    } else {
                        reject(new Error('支付宝支付失败'));
                    }
                });
            } else {
                // 网页支付，显示支付链接
                showPaymentLink(payParams, orderId, 'alipay');
                resolve({ success: true, method: 'web_redirect' });
            }
        });
    }
    
    /**
     * 显示支付二维码
     */
    function showPaymentQRCode(payParams, orderId, method) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            ${method === 'wechat' ? '💬 微信支付' : '💰 支付宝支付'}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body text-center">
                        <div class="border rounded-3 p-3 mb-3">
                            <div class="fw-semibold">请使用${method === 'wechat' ? '微信' : '支付宝'}扫码支付</div>
                        </div>
                        
                        <div class="d-flex justify-content-center mb-3">
                            <div id="qr-code-container" style="width: 200px; height: 200px; background: #f5f5f5; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                                <div class="text-muted">生成二维码中...</div>
                            </div>
                        </div>
                        
                        <div class="text-muted small mb-3">
                            订单号：${orderId}
                        </div>
                        
                        <div class="d-flex gap-2 justify-content-center">
                            <button class="btn btn-outline-primary" onclick="checkPaymentStatus(${orderId})">
                                🔄 检查支付状态
                            </button>
                            <button class="btn btn-secondary" data-bs-dismiss="modal">
                                取消支付
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;
        
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        
        // 生成二维码（这里使用模拟数据）
        setTimeout(() => {
            const qrContainer = document.getElementById('qr-code-container');
            qrContainer.innerHTML = `
                <div class="border" style="width: 180px; height: 180px; background: white; display: flex; align-items: center; justify-content: center; font-size: 12px; text-align: center;">
                    ${method === 'wechat' ? '微信支付' : '支付宝'}<br>
                    二维码<br>
                    (演示版本)
                </div>`;
        }, 1000);
        
        modal.addEventListener('hidden.bs.modal', () => modal.remove());
        
        // 定时检查支付状态
        const statusChecker = setInterval(() => {
            checkPaymentStatus(orderId).then(status => {
                if (status.payment_status === 'paid') {
                    clearInterval(statusChecker);
                    bsModal.hide();
                    showPaymentSuccess(orderId);
                }
            }).catch(() => {
                // 忽略检查错误
            });
        }, 3000);
        
        // 模态框关闭时停止检查
        modal.addEventListener('hidden.bs.modal', () => {
            clearInterval(statusChecker);
        });
    }
    
    /**
     * 显示支付链接
     */
    function showPaymentLink(payParams, orderId, method) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">💰 支付宝支付</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body text-center">
                        <div class="border rounded-3 p-3 mb-3">
                            <div class="fw-semibold">请点击下方按钮前往支付宝完成支付</div>
                        </div>
                        
                        <div class="mb-3">
                            <div class="text-muted small">订单号：${orderId}</div>
                            <div class="fw-bold">支付金额：${payParams.amount}元</div>
                        </div>
                        
                        <div class="d-flex gap-2 justify-content-center">
                            <button class="btn btn-primary" onclick="window.open('#', '_blank')">
                                前往支付宝支付
                            </button>
                            <button class="btn btn-outline-primary" onclick="checkPaymentStatus(${orderId})">
                                我已完成支付
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;
        
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }
    
    /**
     * 检查支付状态
     */
    async function checkPaymentStatus(orderId) {
        try {
            const res = await window.api.fetchAPI(`/api/payment/status/${orderId}/`);
            if (res.ok) {
                const status = await res.json();
                return status;
            }
            throw new Error('检查支付状态失败');
        } catch (error) {
            console.error('检查支付状态失败:', error);
            throw error;
        }
    }
    
    /**
     * 显示支付成功
     */
    function showPaymentSuccess(orderId) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-body text-center p-4">
                        <div class="mb-3">
                            <div class="fs-1 text-success">✅</div>
                            <h5 class="mt-2">支付成功！</h5>
                        </div>
                        
                        <div class="border rounded-3 p-3 mb-3">
                            <div class="mb-1">订单 #${orderId} 支付完成</div>
                            <div class="text-muted small">等待拼单达成目标人数</div>
                        </div>
                        
                        <div class="d-flex gap-2 justify-content-center">
                            <a href="/orders.html" class="btn btn-primary">查看订单</a>
                            <a href="/index.html" class="btn btn-outline-secondary">继续购物</a>
                        </div>
                    </div>
                </div>
            </div>`;
        
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }
    
    /**
     * 全局检查支付状态函数
     */
    window.checkPaymentStatus = checkPaymentStatus;
    
    return {
        initiatePayment,
        checkPaymentStatus,
        showPaymentSuccess
    };
})();
