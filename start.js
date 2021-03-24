#!/usr/bin/env node

const vm = require("vm");
const fs = require("fs");
const qs = require('querystring');

const cheerio = require('cheerio');
const axios = require('axios');
const acjar = require('axios-cookiejar-support').default;
const tough = require('tough-cookie');

function loadfile(path) {
	vm.runInThisContext(fs.readFileSync(path));
}

global.axios = require('axios');
global.cheerio = require('cheerio');
global.FileSys = require("fs");
global.Backbone = require("backbone");
global.WebSocket = require("websocket").w3cwebsocket;

loadfile("./src/Polyfills.js");
loadfile("./src/HoloChat.js");
loadfile("./src/HoloServer.js");
loadfile("./src/HoloManager.js");

loadfile("./src/models/ChatRoom.js");
loadfile("./src/models/ChatRoomMessage.js");
loadfile("./src/models/ChatRoomTree.js");
loadfile("./src/models/ChatUser.js");

loadfile("./src/collections/ChatRooms.js");
loadfile("./src/collections/ChatRoomMessages.js");
loadfile("./src/collections/ChatRoomTrees.js");
loadfile("./src/collections/ChatUsers.js");

loadfile("./src/ChatManager.js");

if (process.env.USER === undefined || process.env.PASS === undefined) {
	console.error("You have to specify user name and password");
	process.exit(1);
}

axios.defaults.withCredentials = true;
axios.defaults.jar = new tough.CookieJar();

acjar(axios);
axios.get("https://chat.hu").then(function(response) {
	let $ = cheerio.load(response.data);
	if ($("#login-form").length === 1) {
		axios.post("https://chat.hu/authentication/default/login", qs.stringify({
			"_csrf": $("meta[name='csrf-token']").attr("content"),
			"LoginForm[username]": process.env.USER,
			"LoginForm[password]": process.env.PASS,
			"LoginForm[rememberMe]": 0,
			"redirect_url": "/"
		}), {
			validateStatus: function(status) { return (status >= 200 && status < 300) || status === 500; }
		}).then(function (response) {
			console.log("Page login successful, starting client");
			process.on("SIGTERM", () => { handleExit(); });
			startChat(parseParams(response.data));
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
			process.exitCode = 1;
			process.kill(process.pid, 'SIGTERM')
		});
	} else {
		console.log("No login was needed, starting client");
		process.on("SIGTERM", () => { handleExit(); });
		startChat(parseParams(response.data));
	}
});

function parseParams(responseData) {
	let line = responseData.split('\n').find(line => { return line.startsWith("HoloChat.init"); })
	let match = line.match(/HoloChat.start\({url:\[(.+)\],userId:"(registered-[0-9]+)",sessionId:"([0-9a-z]+)",debug:false}\);/i);
	return { url: match[1].split(",").map(item => eval(item)), userId: match[2], sessionId: match[3], debug: false };
}

function startChat(clientParams) {
	console.log('Starting HoloChat client.');
	HoloChat.init();
	HoloChat.addManager(ChatManager);
	HoloChat.start(clientParams);
}

function handleExit() {
	console.log('Stopping HoloChat client.');
	HoloChat.stop();
	console.log('User is exiting site.');
	axios.get("https://chat.hu/kilepes").then(() => {
		process.exit(0);
	});
}

process.on('uncaughtException', function(e) {
    console.error('Unhandled exception:', e)
})

