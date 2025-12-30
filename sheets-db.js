let _documents = {};
let _sheets = {};
let _data = {};

_fixNullData();

function _fixNullData() {
	let cachedData = {};
	if (localStorage.cachedData != null) {
		try {
			cachedData = JSON.parse(localStorage.cachedData);
		} catch {
			cachedData = {};
		}
	}

	Object.keys(_sheets).forEach((key) => {
		_data[key] = [];
	});

	localStorage.cachedData = JSON.stringify(cachedData);
}

export function setReferences(documents, sheets) {
	/*  documents = {
	 * 		"doc1Name": "doc1Id",
	 * 		"doc2Name": "doc2Id",
	 * 		...
	 * 	}
	 *
	 * 	sheets = {
	 * 		"sheet1Id": {
	 * 			"name": "sheet1Name",
	 * 			"document": "docName",
	 *			"fields": [
	 *				"field1Name",
	 *				"field2Name",
	 *				...
	 *			]
	 *		},
	 *		...
	 *	}
	 */
	_documents = documents;
	_sheets = sheets;
}

// url utilities

function _makeSheetUrl(sheet) {
	return `https://docs.google.com/spreadsheets/d/${_documents[_sheets[sheet].document]}/gviz/tq?&sheet=${_sheets[sheet].name}&tq=${encodeURIComponent("Select *")}`;
}

function _driveUrlToId(url) {
	return url.substring(url.indexOf("/d/") + 3, url.indexOf("/view"));
}

export function driveUrlToThumb(url, width = 1080) {
	return `https://drive.google.com/thumbnail?id=${_driveUrlToId(url)}&sz=w${width}`;
}

export function driveUrlToDownload(url) {
	return `https://drive.google.com/uc?export=download&id=${_driveUrlToId(url)}`;
}

// fetch utilties

function _parseTable(data) {
	return JSON.parse(data.substring(47).slice(0, -2)).table.rows;
}

async function _fetchAndProcessSheet(sheet, func = () => { }, afterFunc = () => { }) {
	fetch(_makeSheetUrl(sheet))
		.then((res) => res.text())
		.then((rep) => {
			_data[sheet] = _parseTable(rep);
			_afterFetch(sheet, func, afterFunc);
		});
}

async function _afterFetch(sheet, func = () => { }, afterFunc = () => { }) {
	let cachedData = JSON.parse(localStorage.cachedData);
	if (JSON.stringify(_data[sheet]) != JSON.stringify(cachedData[sheet])) {
		cachedData[sheet] = _data[sheet];
		localStorage.cachedData = JSON.stringify(cachedData);
		func();
	}
	afterFunc();
}

async function _fetchSheet(sheet, func = () => { }, afterFunc = () => { }) {
	let cachedData = JSON.parse(localStorage.cachedData);

	if (cachedData[sheet] != null) {
		_data[sheet] = cachedData[sheet];
		try {
			func();
		} catch {
			// if data is corrupt, fetch
		}
		_fetchAndProcessSheet(sheet, func, afterFunc);
	} else {
		await _fetchAndProcessSheet(sheet, func, afterFunc);
	}
}

export async function fetchSheet(sheet, func = () => { }) {
	await _fetchSheet(sheet, func, () => { })
}

export async function fetchSheets(sheets, func = () => { }) {
	let promises = [];
	let haveData = new Set();
	let fetched = new Set();

	let isFirstCall = true;
	let needsReCall = false;

	for (let i = 0; i < sheets.length; i++) {
		promises.push(
			_fetchSheet(sheets[i],
				() => {
					// before fetch
					if (haveData.has(sheets[i])) {
						// re-call must be needed
						needsReCall = true;
					}
					haveData.add(sheets[i]);
					if (isFirstCall && haveData.size == sheets.length) {
						isFirstCall = false;
						func();
					}
				},
				() => {
					//after fetch
					fetched.add(sheets[i]);

					if ((needsReCall || isFirstCall) && fetched.size == sheets.length) {
						func();
					}
				}
			)
		);
	}
}

// cell utilities

export function getCell(sheet, record, field, isFormattedString = false) {
	if (_data[sheet][record].c[_sheets[sheet]._cols.indexOf(field)] != null) {
		if (isFormattedString == true) {
			return _data[sheet][record].c[_sheets[sheet]._cols.indexOf(field)].f;
		} else {
			return _data[sheet][record].c[_sheets[sheet]._cols.indexOf(field)].v;
		}
	}
	return null;
}

export function anyCellNull(sheet, record, fields) {
	for (let i = 0; i < fields.length; i++) {
		if (getCell(sheet, record, fields[i]) == null) {
			return true;
		}
	}
	return false;
}

export function anyCellFilled(sheet, record, fields) {
	for (let i = 0; i < fields.length; i++) {
		if (getCell(sheet, record, fields[i]) != null) {
			return true;
		}
	}
	return false;
}

// date utilities

export function splitDate(date) {
	return date.split("(")[1].split(")")[0].split(",");
}

export function dateToUTC(date, isSplit = false) {
	let dateArr = date;
	if (isSplit == false) {
		dateArr = splitDate(date);
	}

	if (dateArr.length > 3) {
		return Date.UTC(dateArr[0], dateArr[1], dateArr[2], dateArr[3], dateArr[4]);
	}
	return Date.UTC(dateArr[0], dateArr[1], dateArr[2]);
}

let _months = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December"
];

export function dateToString(date, format = ["d", "Mmm", "yyyy"], sep = " ", isSplit = false) {
	let dateArr = date;
	if (isSplit == false) {
		dateArr = splitDate(date);
	}

	outDate = "";
	for (let i = 0; i < format.length; i++) {
		switch (format[i]) {
			case "d":
				outDate += dateArr[2];
				break;
			case "dd":
				if (dateArr[2] < 10) {
					outDate += "0";
				}
				outDate += dateArr[2];
				break;
			case "m":
				outDate += String(Number(dateArr[1]) + 1);
				break;
			case "mm":
				if (dateArr[1] < 9) {
					outDate += "0";
				}
				outDate += String(Number(dateArr[1]) + 1);
				break;
			case "Mmm":
				outDate += _months[Number(dateArr[1])].substring(0, 3);
				break;
			case "Mmmm":
				outDate += _months[Number(dateArr[1])];
				break;
			case "yy":
				outDate += dateArr[0].substring(2, 4);
				break;
			case "yyyy":
				outDate += dateArr[0];
				break;
		}
		if (i < format.length - 1) {
			outDate += sep;
		}
	}

	return outDate;
}

// HTML utilities

let _ords = [
	"0th",
	"1st",
	"2nd",
	"3rd",
	"4th",
	"5th",
	"6th",
	"7th",
	"8th",
	"9th"
];

export function fixOrdinalsHTML(text) {
	let out = text;

	for (let i = 0; i < _ords.length; i++) {
		let j = out.indexOf(_ords[i]);
		if (j > -1) {
			out = `${out.substring(0, j + 1)}<sup>${_ords[i].substring(1)}</sup>${out.substring(j + 3)}`;
			i--;
		}
	}
	return out;
}

export function textToParagraph(text) {
	let paras = text.split("\n\n");
	let html = "";
	paras.forEach((el) => {
		html += `<p>${el}</p>`;
	});
	return html;
}
