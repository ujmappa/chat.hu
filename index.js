const vm = require("vm");
const fs = require("fs");
const ps = require("process");

const ch = require('cheerio');
const qs = require('querystring');

const axios = require('axios');
const acjar = require('axios-cookiejar-support').default;
const tough = require('tough-cookie');

function loadfile(path) {
	vm.runInThisContext(fs.readFileSync(path));
}

global.Cookies = require("js-cookie");
global.Backbone = require("backbone");

loadfile("./src/app/HoloChat.js");
loadfile("./src/app/ChatServer.js");
loadfile("./src/app/ChatManager.js");

loadfile("./src/app/models/ChatRoom.js");
loadfile("./src/app/models/ChatRoomMessage.js");
loadfile("./src/app/models/ChatRoomTree.js");
loadfile("./src/app/models/ChatUser.js");

loadfile("./src/app/collections/ChatRooms.js");
loadfile("./src/app/collections/ChatRoomMessages.js");
loadfile("./src/app/collections/ChatRoomTrees.js");
loadfile("./src/app/collections/ChatUsers.js");


const cookies = new tough.CookieJar();
axios.defaults.withCredentials = true;
axios.defaults.jar = cookies;

acjar(axios);
axios.get("https://chat.hu").then(function (response) {
	let $ = ch.load(response.data);
	if ($("#login-form").length === 1) {
		axios.post("https://chat.hu/authentication/default/login?exit=0", qs.stringify({
			"_csrf": $("meta[name='csrf-token']").attr("content"),
			"LoginForm[username]": process.env.USER,
			"LoginForm[password]": process.env.PASS,
			"LoginForm[rememberMe]": 0,
			"redirect_url": "/",
			"ajax": "login-form"
		}), {
			validateStatus: function(status) {
				return (status >= 200 && status < 300) || status === 500; // redirect suxx
			}
		}).then(function (response) {
			process.on("SIGTERM", () => { axios.get("https://chat.hu/kilepes"); });
			console.log(parseHoloChatParams(response.data));
		}).catch(function (error) {
			if (error.response) {
				console.log(error.response.data);
				console.log(error.response.status);
				console.log(error.response.headers);
			} else if (error.request) {
				console.log(error.request);
			} else {
				console.log('Error', error.message);
			}
			console.log(error.config);
			ps.exit(1);
		});
	} else {
		process.on("SIGTERM", () => { axios.get("https://chat.hu/kilepes"); });
		console.log(parseHoloChatParams(response.data));
	}
});

function parseHoloChatParams(responseData) {
	let line = responseData.split('\n').find(line => { return line.startsWith("HoloChat.init"); })
	let match = line.match(/HoloChat.start\({url:\[(.+)\],userId:"(registered-[0-9]+)",sessionId:"([0-9a-z]+)",debug:false}\);/i);
	return { url: match[1].split(","), userId: match[2], sessionId: match[3], debug: false };
}

function startHoloChatClient(clientParams) {
	HoloChat.init();
	HoloChat.addManager(ChatManager);
	HoloChat.start(clientParams);
}
