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

	/** 是否为 v12+ 服务器 */
	static isV12 = false;

	/**
	 * 父元素选择器
	 * 默认(服务器版本 < 12.0): .mainAnimatedPages:not(.hide)
	 * 服务器版本 >= 12.0:    .skinBody:not(.mainAnimatedPages)
	 * 由 initContainer() 在 start() 中动态决定
	 */
	static container = ".mainAnimatedPages:not(.hide)";

	static async start() {
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

		// 先根据服务器版本确定父元素选择器, 再开始轮询
		await this.initContainer();

		setInterval(() => {
			if (window.location.href.indexOf("/home") != -1) {
				if ($(`${this.container} .misty-banner`).length == 0 && $(".misty-loading").length == 0) {
					this.initStart = false;
					this.initLoading();
				}
				if ($(".hide .misty-banner").length != 0) {
					$(".hide .misty-banner").remove();
				}
				if (!this.initStart && $(".section0 .card").length != 0 && $(`${this.container} .misty-banner`).length == 0) {
					this.initStart = true;
					this.init();
				}
			}
		}, 100);
	}

	/**
	 * 获取服务器版本并决定父元素选择器
	 * 版本 >= 12.0 使用 .skinBody:not(.mainAnimatedPages)
	 */
	static async initContainer() {
		let version = "0.0.0";
		try {
			const info = await this.getServerVersion();
			version = (info && (info.Version || info.version)) || "0.0.0";
		} catch (e) {
			console.warn("[Misty] 获取服务器版本失败, 使用默认选择器", e);
		}
		const major = parseInt(String(version).split(".")[0], 10) || 0;

		this.isV12 = major >= 12;
		this.container = this.isV12
			? ".skinBody:not(.mainAnimatedPages)"
			: ".mainAnimatedPages:not(.hide)";
		console.log(`[Misty] 服务器版本: ${version}, 父元素选择器: ${this.container}`);
		return version;
	}

	/**
	 * 通过注入方式调用 window.ApiClient.getPublicSystemInfo() 获取服务器信息
	 */
	static getServerVersion() {
		return this.injectCall("getPublicSystemInfo", "");
	}

	static async init() {
		// Beta
		$(`${this.container}`).attr("data-type", "home");
		// Loading
		$(".misty-loading img").addClass("active");
		// Banner
		await this.initBanner();
		this.initEvent();
	}

	/* 插入Loading */
	static initLoading() {
		const load = `<div class="misty-loading"><img loading="auto" decoding="lazy" alt="Logo" src="emby-crx/icon-transparent.png" style="max-width:200px;"><div class="mdl-spinner"><div class="mdl-spinner__layer mdl-spinner__layer-1"><div class="mdl-spinner__circle-clipper mdl-spinner__left"><div class="mdl-spinner__circle mdl-spinner__circleLeft"></div></div><div class="mdl-spinner__circle-clipper mdl-spinner__right"><div class="mdl-spinner__circle mdl-spinner__circleRight"></div></div></div></div></div>`;
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
		const bannerV12Class = this.isV12 ? " banner-v12" : "";
		const banner = `<div class="misty-banner${bannerV12Class}"><div class="misty-banner-body"></div><div class="misty-banner-library"></div><div class="misty-banner-nav misty-banner-prev">&#10094;</div><div class="misty-banner-nav misty-banner-next">&#10095;</div></div>`;

		const $container = $(this.container).first();
		const $section0 = $container.find(".section0").first();

		// 关键改动: 把 banner 插到 section0 之前, 不移动 section0
		$section0.before(banner);

		// 插入数据
		const data = await this.getItems(this.itemQuery);

		data.Items.forEach(async (item) => {
			const detail = await this.getItem(item.Id);
			const img_url = await this.getImageUrl(detail.Id, this.coverOptions);
			var itemHtml = `
			<div class="misty-banner-item" id="${detail.Id}">
				<img draggable="false" loading="eager" decoding="async" class="misty-banner-cover" src="${img_url}" alt="Backdrop" >
				<a href="#/details?id=${detail.Id}&amp;serverId=${detail.ServerId}" class="misty-banner-info padded-left padded-right" data-action="link" aria-label="${detail.Name}" >
				`;

			if (detail.ImageTags && detail.ImageTags.Logo) {
				var logo_url = img_url.replace('Backdrop?maxWidth=3000&quality=80', 'Logo?maxWidth=3000');
				itemHtml += `
				<img id="${detail.Id}" draggable="false" loading="auto" decoding="lazy" class="misty-banner-logo" data-banner="img-title" alt="Logo" src="${logo_url}">
				`;
			}

			itemHtml += `
					<div>
						<p>▸ <strong>${detail.Name}</strong> ◂ ${detail.Overview.trim()}</p>
					</div>
				</a>
			</div>
			`;

			$(".misty-banner-body").append(itemHtml);
		});

		// 只判断第一张海报加载完毕, 优化加载速度
		await new Promise((resolve, reject) => {
			let waitLoading = setInterval(() => {
				let cover = document.querySelector(".misty-banner-cover");
				if (cover && cover.complete) {
					clearInterval(waitLoading);
					resolve();
				}
			}, 16);
		});

		$(".misty-loading").fadeOut(500, () => $(".misty-loading").remove());
		await CommonUtils.sleep(150);

		// 置入场动画
		let delay = 80;
		let id = $(".misty-banner-item").eq(0).addClass("active").attr("id");
		$(`.misty-banner-logo[id=${id}]`).addClass("active");

		await CommonUtils.sleep(200);

		// 关键改动: 卡片现在在 .section0 内, 不在 .misty-banner 内
		$(".section0 > div").addClass("misty-banner-library-overflow");
		$section0.find(".card").each((i, dom) =>
			setTimeout(() => $(dom).addClass("misty-banner-library-show"), i * delay)
		);
		await CommonUtils.sleep(delay * 8 + 1000);
		$(".section0 > div").removeClass("misty-banner-library-overflow");

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

			startInterval();
		};

		const startInterval = () => {
			clearInterval(this.bannerInterval);
			this.bannerInterval = setInterval(() => {
				if (window.location.href.indexOf("/home") != -1 && !document.hidden) {
					switchBanner(this.bannerIndex + 1);
				}
			}, 8000);
		};

		$(".misty-banner-prev").on("click", () => switchBanner(this.bannerIndex - 1));
		$(".misty-banner-next").on("click", () => switchBanner(this.bannerIndex + 1));

		startInterval();

	}

	/* 初始事件 */
	static initEvent() {
		const script = `
		const serverId = ApiClient._serverInfo.Id,
			librarys = document.querySelectorAll("${this.container} .section0 .card");
		librarys.forEach(library => {
			library.setAttribute("data-serverid", serverId);
			library.setAttribute("data-type", "CollectionFolder");
		});

		document.querySelectorAll("emby-scroller").forEach(scroller => {
			const next = scroller.nextSibling;
			// 跳过文本节点 (换行/空白) 之类会导致 e.addScrollEventListener is not a function 的节点
			if (next && next.nodeType !== 1) {
				// 找下一个真正的元素兄弟
				let el = next;
				while (el && el.nodeType !== 1) el = el.nextSibling;
				if (el && typeof el.addScrollEventListener !== "function") {
					el.addScrollEventListener = function () {};
					el.removeScrollEventListener = function () {};
				}
			} else if (next && typeof next.addScrollEventListener !== "function") {
				next.addScrollEventListener = function () {};
				next.removeScrollEventListener = function () {};
			}
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