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
			"LoginForm[rememberMe]": 0
		}), {
			validateStatus: function(status) { return (status >= 200 && status < 300) || status === 500; }
		}).then(function (response) {
			console.log("Page login successful, opening site...");
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
			process.kill(process.pid, 'SIGTERM');
		});
	} else {
		console.log("No login was needed, opening site...");
		process.on("SIGTERM", () => { handleExit(); });
		startChat(parseParams(response.data));
	}
}).catch((error) => {
	console.error("Site is unreachable and throws error:", error);
	process.exitCode = 1;
	process.kill(process.pid, 'SIGTERM');
});

function parseParams(responseData) {
	let line = responseData.split('\n').find(line => line.startsWith("HoloChat.init"));
	if (line !== undefined) {
		console.log("Found line with parameters:", line.substr(line.search("HoloChat.start")));
		let match = line.match(/HoloChat.start\({url:\[(.+)\],userId:"(registered-[0-9]+)",sessionId:"([0-9a-z]+)",debug:false}\);/i);
		if (match !== null && Array.isArray(match) && match.length > 3) {
			var urls = match[1].split(",").map(item => eval(item)).filter(item => item.startsWith("wss://"));
			return { url: urls, userId: match[2], sessionId: match[3], debug: false };
		} else {
			console.error("Parameters did not match pattern!");
		}
	} else {
		console.error("Did not find line with parameters!");
	}
	return null;
}

function startChat(clientParams) {
	if (clientParams !== null) {
		console.log('Starting chat client with session:', clientParams.sessionId);
		HoloChat.init();
		HoloChat.addManager(ChatManager);
		HoloChat.events.on('chat:close', function() {
			console.log('Lost connection, closing program...');
			process.exitCode = 130;
			process.kill(process.pid, 'SIGTERM');
		}, this);
		HoloChat.events.on('chat:failed', function() {
			console.log('Room enter failed, closing program...');
			process.exitCode = 131;
			process.kill(process.pid, 'SIGTERM');
		});
		HoloChat.start(clientParams);
	} else {
		console.log('Wrong client parameters, exiting.');
		process.exitCode = 129;
		process.kill(process.pid, 'SIGTERM');
	}
}

function handleExit() {
	console.log('Stopping chat client if running...');
	HoloChat.stop();
	console.log('Leaving site and exiting program.');
	axios.get("https://chat.hu/kilepes").then(() => {
		process.exit(0);
	}).catch(() => {
		process.exit(0);
	});
}

process.on('uncaughtException', function(e) {
    console.error('Unhandled exception:', e)
})

