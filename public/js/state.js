// Estado global compartido entre todos los módulos
let token = localStorage.getItem('socio_token');
let currentUser = null;
let currentSpaceId = null;
let spaceData = { compra: [], tareas: [], agenda: [], notas: [], members: [], inviteCode: null };
let pollTimer = null;
let chatHistory = [];
let currentTab = 'chat';
let editNoteId = null;
let editEventId = null;
let ticketData = null;
let ttsOn = localStorage.getItem('socio_tts') !== 'off';
let handsFreeOn = false;
let hfPaused = false;
let hfRestartTimer = null;
let isListening = false;
let vapidKey = null;
