RegExp.quote = function(str) {
    return str.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
};

String.prototype.padLeft = function (padValue) {
    return String(padValue + this).slice(-padValue.length);
};