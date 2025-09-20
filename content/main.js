
class CommonUtils {
	static selectWait(selector, func, times, interval) {
		var _times = times || 100, //100次
			_interval = interval || 500, //20毫秒每次
			_jquery = null,
			_iIntervalID;

		_iIntervalID = setInterval(() => {
			if (!_times) {
				clearInterval(_iIntervalID);
			}
			_times <= 0 || _times--;
			_jquery = $(selector);
			if (_jquery.length) {
				func && func.call(func);
				clearInterval(_iIntervalID);
			}
		}, _interval);
		return this;
	}

	static selectNotWait(selector, func, interval) {
		let _jquery,
			_interval = interval || 20,
			_iIntervalID;

		_iIntervalID = setInterval(() => {
			_jquery = $(selector);
			if (_jquery.length < 1) {
				func && func.call(func);
				clearInterval(_iIntervalID);
			}
		}, _interval);
	}

	static copyText(value, cb) {
		const textarea = document.createElement("textarea");
		textarea.readOnly = "readonly";
		textarea.style.position = "absolute";
		textarea.style.left = "-9999px";
		textarea.value = value;
		document.body.appendChild(textarea);
		textarea.select();
		textarea.setSelectionRange(0, textarea.value.length);
		document.execCommand("Copy");
		document.body.removeChild(textarea);
		if (cb && Object.prototype.toString.call(cb) === "[object Function]") {
			cb();
		}
	}

	/**
	 * 休眠
	 * @param {number} ms 休眠多少毫秒
	 */
	static sleep(ms) {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				resolve("完成");
			}, ms);
		});
	}
}


class HomeBanner {
	static bannerIndex = 0;
	static start() {
		this.cache = {
			items: undefined,
			item: new Map(),
		};
		this.itemQuery = { 
			ImageTypes: "Backdrop", 
			EnableImageTypes: "Logo,Backdrop", 
			IncludeItemTypes: "Movie,Series", 
			SortBy: "ProductionYear, PremiereDate, SortName", 
			Recursive: true, 
			ImageTypeLimit: 1, 
			Limit: 10, 
			Fields: "ProductionYear", 
			SortOrder: "Descending", 
			EnableUserData: false, 
			EnableTotalRecordCount: false 
		};
		this.coverOptions = { type: "Backdrop", maxWidth: 3000 };
		this.logoOptions = { type: "Logo", maxWidth: 3000 };
		this.initStart = false;
		setInterval(() => {
			if (window.location.href.indexOf("/home.html") != -1) {
				if ($(".mainAnimatedPages:not(.hide) .misty-banner").length == 0 && $(".misty-loading").length == 0) {
					this.initStart = false;
					this.initLoading();
				}
				if ($(".hide .misty-banner").length != 0) {
					$(".hide .misty-banner").remove();
				}
				if (!this.initStart && $(".section0 .card").length != 0 && $(".mainAnimatedPages:not(.hide) .misty-banner").length == 0) {
					this.initStart = true;
					this.init();
				}
				// $(".headerTabs").hide();
			} else{
				// $(".headerTabs").show();
			}
		}, 100);
	}

	static async init() {
		// Beta
		$(".mainAnimatedPages:not(.hide)").attr("data-type", "home");
		// Loading
		$(".misty-loading img").addClass("active");
		// Banner
		await this.initBanner();
		this.initEvent();
	}

	/* 插入Loading */
	static initLoading() {
		const load = `
		<div class="misty-loading">
			<img loading="auto" decoding="lazy" alt="Logo" src="assets/img/icon-transparent.png" style="max-width:200px;">
			<div class="mdl-spinner">
				<div class="mdl-spinner__layer mdl-spinner__layer-1">
					<div class="mdl-spinner__circle-clipper mdl-spinner__left">
						<div class="mdl-spinner__circle mdl-spinner__circleLeft"></div>
					</div>
					<div class="mdl-spinner__circle-clipper mdl-spinner__right">
						<div class="mdl-spinner__circle mdl-spinner__circleRight"></div>
					</div>
				</div>
			</div>
		</div>
		`;
		$("body").append(load);
	}

	static injectCode(code) {
		let hash = md5(code + Math.random().toString());
		return new Promise((resolve, reject) => {
			if ("BroadcastChannel" in window) {
				const channel = new BroadcastChannel(hash);
				channel.addEventListener("message", (event) => resolve(event.data));
			} else if ("postMessage" in window) {
				window.addEventListener("message", (event) => {
					if (event.data.channel === hash) {
						resolve(event.data.message);
					}
				});
			}
			const script = `
			<script class="I${hash}">
				setTimeout(async ()=> {
					async function R${hash}(){${code}};
					if ("BroadcastChannel" in window) {
						const channel = new BroadcastChannel("${hash}");
						channel.postMessage(await R${hash}());
					} else if ('postMessage' in window) {
						window.parent.postMessage({channel:"${hash}",message:await R${hash}()}, "*");
					}
					document.querySelector("script.I${hash}").remove()
				}, 16)
			</script>
			`;
			$(document.head || document.documentElement).append(script);
		});
	}

	static injectCall(func, arg) {
		const script = `
		const client = await new Promise((resolve, reject) => {
			setInterval(() => {
				if (window.ApiClient != undefined) resolve(window.ApiClient);
			}, 16);
		});
		return await client.${func}(${arg});
		`;
		return this.injectCode(script);
	}

	static getItems(query) {
		if (this.cache.items == undefined) {
			this.cache.items = this.injectCall("getItems", "client.getCurrentUserId(), " + JSON.stringify(query));
		}
		return this.cache.items;
	}

	static async getItem(itemId) {
		// 双缓存 优先使用 WebStorage
		if (typeof Storage !== "undefined" && !localStorage.getItem("CACHE|" + itemId) && !this.cache.item.has(itemId)) {
			const data = JSON.stringify(await this.injectCall("getItem", `client.getCurrentUserId(), "${itemId}"`));
			if (typeof Storage !== "undefined") localStorage.setItem("CACHE|" + itemId, data);
			else this.cache.item.set(itemId, data);
		}
		return JSON.parse(typeof Storage !== "undefined" ? localStorage.getItem("CACHE|" + itemId) : this.cache.item.get(itemId));
	}

	static getImageUrl(itemId, options) {
		return this.injectCall("getImageUrl", "'"+ itemId + "', " + JSON.stringify(options));
	}

	/* 插入Banner */
	static async initBanner() {
		const banner = `
		<div class="misty-banner">
			<div class="misty-banner-body"></div>
			<div class="misty-banner-library"></div>
			<!-- 左右切换按钮 -->
			<div class="misty-banner-nav misty-banner-prev">&#10094;</div>
			<div class="misty-banner-nav misty-banner-next">&#10095;</div>
		</div>
		`;
		$(".mainAnimatedPages:not(.hide) .homeSectionsContainer").prepend(banner);
		$(".mainAnimatedPages:not(.hide) .section0").detach().appendTo(".mainAnimatedPages:not(.hide) .misty-banner-library");

		// 插入数据
		const data = await this.getItems(this.itemQuery);

		data.Items.forEach(async (item) => {
			const detail = await this.getItem(item.Id);
			const img_url = await this.getImageUrl(detail.Id, this.coverOptions);
			var itemHtml = `
			<div class="misty-banner-item" id="${detail.Id}">
				<img draggable="false" loading="eager" decoding="async" class="misty-banner-cover" src="${img_url}" alt="Backdrop" style="">
				<div class="misty-banner-info padded-left padded-right">`;

			if (detail.ImageTags && detail.ImageTags.Logo) {
				var logo_url = img_url.replace('Backdrop?maxWidth=3000&quality=80', 'Logo?maxWidth=3000');
				itemHtml += `
				<img id="${detail.Id}" draggable="false" loading="auto" decoding="lazy" class="misty-banner-logo" data-banner="img-title" alt="Logo" onclick="window.Emby.Page.showItem('${detail.Id}')" src="${logo_url}">
				`;
			}

			itemHtml += `
					<div><p onclick="window.Emby.Page.showItem('${detail.Id}')"><strong>${detail.Name}</strong>${detail.Overview}</p></div>
					<div><button onclick="window.Emby.Page.showItem('${detail.Id}')">MORE</button></div>
				</div>
			</div>
			`;

			$(".misty-banner-body").append(itemHtml);

			// if (detail.ImageTags && detail.ImageTags.Logo) {
			// 	const logo_url = img_url.replace('Backdrop?maxWidth=3000&quality=80', 'Logo?maxWidth=3000');
			// 	const logoHtml = `
			// 	<img id="${detail.Id}" draggable="false" loading="auto" decoding="lazy" class="misty-banner-logo" data-banner="img-title" alt="Logo" src="${logo_url}">
			// 	`;
			// 	$(".misty-banner-logos").append(logoHtml);
			// }

		});

		// 只判断第一张海报加载完毕, 优化加载速度
		await new Promise((resolve, reject) => {
			let waitLoading = setInterval(() => {
				let cover = document.querySelector(".misty-banner-cover")
				if (cover && cover.complete) {
					clearInterval(waitLoading);
					resolve();
				}
			}, 16);
		});

		$(".misty-loading").fadeOut(500, () => $(".misty-loading").remove());
		await CommonUtils.sleep(150);
		// 置入场动画
		let delay = 80; // 动媒体库画间隔
		let id = $(".misty-banner-item").eq(0).addClass("active").attr("id"); // 初次信息动画
		$(`.misty-banner-logo[id=${id}]`).addClass("active");

		await CommonUtils.sleep(200); // 间隔动画
		$(".section0 > div").addClass("misty-banner-library-overflow"); // 关闭overflow 防止媒体库动画溢出
		$(".misty-banner .card").each((i, dom) => setTimeout(() => $(dom).addClass("misty-banner-library-show"), i * delay)); // 媒体库动画
		await CommonUtils.sleep(delay * 8 + 1000); // 等待媒体库动画完毕
		$(".section0 > div").removeClass("misty-banner-library-overflow"); // 开启overflow 防止无法滚动

		// 滚屏逻辑
		this.bannerIndex = 0;

		const switchBanner = (newIndex) => {
			const total = $(".misty-banner-item").length;
			if (newIndex < 0) newIndex = total - 1;
			if (newIndex >= total) newIndex = 0;

			this.bannerIndex = newIndex;

			$(".misty-banner-body").css("left", -(this.bannerIndex * 100).toString() + "%");

			$(".misty-banner-item.active").removeClass("active");
			let id = $(".misty-banner-item").eq(this.bannerIndex).addClass("active").attr("id");

			$(".misty-banner-logo.active").removeClass("active");
			$(`.misty-banner-logo[id=${id}]`).addClass("active");

			// 切换完成后重建计时器
    		startInterval();
		};

		// 自动切换计时器
		const startInterval = () => {
			clearInterval(this.bannerInterval);
			this.bannerInterval = setInterval(() => {
				if (window.location.href.endsWith("home.html") && !document.hidden) {
					switchBanner(this.bannerIndex + 1);
				}
			}, 8000);
		};

		// 点击左右按钮
		$(".misty-banner-prev").on("click", () => switchBanner(this.bannerIndex - 1));
		$(".misty-banner-next").on("click", () => switchBanner(this.bannerIndex + 1));

		// 页面加载完成后启动自动切换
		startInterval();

	}

	/* 初始事件 */
	static initEvent() {
		// 通过注入方式, 方可调用appRouter函数, 以解决Content-Script window对象不同步问题
		const script = `
		// 修复library事件参数
		const serverId = ApiClient._serverInfo.Id,
			librarys = document.querySelectorAll(".mainAnimatedPages:not(.hide) .section0 .card");
		librarys.forEach(library => {
			library.setAttribute("data-serverid", serverId);
			library.setAttribute("data-type", "CollectionFolder");
		});
		`;
		this.injectCode(script);
	}
}

// 运行
if ("BroadcastChannel" in window || "postMessage" in window) {
	if ($("meta[name=application-name]").attr("content") == "Jellyfin" || $(".accent-emby") != undefined) {
		HomeBanner.start();		
	}
}