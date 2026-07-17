const express = require('express');
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const multer = require('multer');
const scheduleStore = require('../services/scheduleStore');
const customCommandStore = require('../services/customCommandStore');
const deletedMessageStore = require('../services/deletedMessageStore');
const chatResponseSettingsStore = require('../services/chatResponseSettingsStore');
const accessControlStore = require('../services/accessControlStore');
const builtInCommandSettingsStore = require('../services/builtInCommandSettingsStore');
const vendingStore = require('../services/vendingStore');

const uploadDir = path.join(process.cwd(), 'uploads');
const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const baseName = path
      .basename(file.originalname || 'media', ext)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-');
    cb(null, `${Date.now()}-${baseName || 'media'}${ext}`);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

function parseClientLocalDateTime(scheduleAt, timezoneOffsetMinutes) {
  const raw = String(scheduleAt || '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const offset = Number.isFinite(Number(timezoneOffsetMinutes))
    ? Number(timezoneOffsetMinutes)
    : 0;

  const utcMs = Date.UTC(year, month - 1, day, hour, minute) + (offset * 60 * 1000);
  const parsed = dayjs(utcMs);

  if (!parsed.isValid()) return null;
  return parsed;
}

function createDashboardRouter(whatsappService) {
  const router = express.Router();

  async function getDashboardViewData() {
    const schedules = await scheduleStore.listSchedules();
    const waState = whatsappService.getConnectionState();
    const scheduleStats = schedules.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.status === 'pending') acc.pending += 1;
        if (item.status === 'sent') acc.sent += 1;
        if (item.status === 'failed') acc.failed += 1;
        return acc;
      },
      { total: 0, pending: 0, sent: 0, failed: 0 }
    );

    const customCommands = customCommandStore.listCommands();
    const deletedMessages = deletedMessageStore.listRecords();
    const chatResponseSettings = chatResponseSettingsStore.getSettings();
    const accessControlSettings = accessControlStore.getSettings();
    const builtInCommandSettings = builtInCommandSettingsStore.getSettings();

    return {
      schedules,
      waState,
      scheduleStats,
      dayjs,
      customCommands,
      commandCategories: customCommandStore.ALLOWED_CATEGORIES,
      mediaTypes: customCommandStore.ALLOWED_MEDIA_TYPES,
      deletedMessages,
      chatResponseSettings,
      accessControlSettings,
      builtInCommandSettings,
    };
  }

  router.get('/', async (req, res, next) => {
    try {
      const viewData = await getDashboardViewData();
      res.render('dashboard', viewData);
    } catch (error) {
      next(error);
    }
  });

  router.get('/schedule/create', (req, res) => {
    return res.render('schedule-share', {
      mediaTypes: customCommandStore.ALLOWED_MEDIA_TYPES,
    });
  });

  router.get('/api/custom-commands', (req, res) => {
    return res.json({ commands: customCommandStore.listCommands() });
  });

  router.get('/api/vending/routes', (req, res) => {
    return res.json({ routes: vendingStore.listRoutes() });
  });

  router.post('/api/vending/routes', (req, res) => {
    try {
      const created = vendingStore.createRoute(req.body || {});
      return res.status(201).json(created);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  router.put('/api/vending/routes/:id', (req, res) => {
    try {
      const updated = vendingStore.updateRoute(req.params.id, req.body || {});
      return res.json(updated);
    } catch (error) {
      const status = error.message === 'Route not found' ? 404 : 400;
      return res.status(status).json({ error: error.message });
    }
  });

  router.delete('/api/vending/routes/:id', (req, res) => {
    try {
      const removed = vendingStore.removeRoute(req.params.id);
      if (!removed) {
        return res.status(404).json({ error: 'Route not found' });
      }
      return res.status(204).send();
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  router.get('/api/vending/locations', (req, res) => {
    return res.json({ locations: vendingStore.listLocations() });
  });

  router.post('/api/vending/locations', (req, res) => {
    try {
      const created = vendingStore.createLocation(req.body || {});
      return res.status(201).json(created);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  router.put('/api/vending/locations/:id', (req, res) => {
    try {
      const updated = vendingStore.updateLocation(req.params.id, req.body || {});
      return res.json(updated);
    } catch (error) {
      const status = error.message === 'Location not found' ? 404 : 400;
      return res.status(status).json({ error: error.message });
    }
  });

  router.delete('/api/vending/locations/:id', (req, res) => {
    try {
      const removed = vendingStore.removeLocation(req.params.id);
      if (!removed) {
        return res.status(404).json({ error: 'Location not found' });
      }
      return res.status(204).send();
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  router.get('/api/vending/route-locations', (req, res) => {
    return res.json({ routeLocations: vendingStore.listRouteLocations() });
  });

  router.post('/api/vending/route-locations', (req, res) => {
    try {
      const created = vendingStore.createRouteLocation(req.body || {});
      return res.status(201).json(created);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  router.put('/api/vending/route-locations/:id', (req, res) => {
    try {
      const updated = vendingStore.updateRouteLocation(req.params.id, req.body || {});
      return res.json(updated);
    } catch (error) {
      const status = error.message === 'Route Location mapping not found' ? 404 : 400;
      return res.status(status).json({ error: error.message });
    }
  });

  router.delete('/api/vending/route-locations/:id', (req, res) => {
    const removed = vendingStore.removeRouteLocation(req.params.id);
    if (!removed) {
      return res.status(404).json({ error: 'Route Location mapping not found' });
    }
    return res.status(204).send();
  });

  router.post('/api/custom-commands', (req, res) => {
    try {
      const created = customCommandStore.createCommand(req.body || {});
      return res.status(201).json(created);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  router.post('/api/custom-commands/upload-media', upload.single('mediaFile'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const mediaType = String(req.body?.mediaType || '').trim();
      const allowedMedia = new Set(customCommandStore.ALLOWED_MEDIA_TYPES);
      if (!allowedMedia.has(mediaType)) {
        return res.status(400).json({ error: 'Invalid media type for upload' });
      }

      const host = req.get('host');
      const protocol = req.protocol || 'http';
      const mediaUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

      return res.status(201).json({
        mediaUrl,
        fileName: req.file.originalname || req.file.filename,
      });
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Failed to upload media file' });
    }
  });

  router.put('/api/custom-commands/:trigger', (req, res) => {
    try {
      const updated = customCommandStore.updateCommand(req.params.trigger, req.body || {});
      return res.json(updated);
    } catch (error) {
      const status = error.message === 'Command not found' ? 404 : 400;
      return res.status(status).json({ error: error.message });
    }
  });

  router.delete('/api/custom-commands/:trigger', (req, res) => {
    const removed = customCommandStore.removeCommand(req.params.trigger);
    if (!removed) {
      return res.status(404).json({ error: 'Command not found' });
    }
    return res.status(204).send();
  });

  router.post('/api/schedules/upload-media', upload.single('mediaFile'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const mediaType = String(req.body?.mediaType || '').trim();
      const allowedMedia = new Set(customCommandStore.ALLOWED_MEDIA_TYPES);
      if (!allowedMedia.has(mediaType)) {
        return res.status(400).json({ error: 'Invalid media type for upload' });
      }

      const host = req.get('host');
      const protocol = req.protocol || 'http';
      const mediaUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

      return res.status(201).json({
        mediaUrl,
        fileName: req.file.originalname || req.file.filename,
      });
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Failed to upload media file' });
    }
  });

  router.post('/api/messages/upload-media', upload.single('mediaFile'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const mediaType = String(req.body?.mediaType || '').trim();
      const allowedMedia = new Set(customCommandStore.ALLOWED_MEDIA_TYPES);
      if (!allowedMedia.has(mediaType)) {
        return res.status(400).json({ error: 'Invalid media type for upload' });
      }

      const host = req.get('host');
      const protocol = req.protocol || 'http';
      const mediaUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

      return res.status(201).json({
        mediaUrl,
        fileName: req.file.originalname || req.file.filename,
      });
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Failed to upload media file' });
    }
  });

  router.post('/api/schedules', async (req, res, next) => {
    try {
      const {
        targetType,
        targetValue,
        message,
        scheduleAt,
        timezoneOffsetMinutes,
        repeatType,
        repeatDays,
        mediaType,
        mediaUrl,
        fileName,
      } = req.body;
      const normalizedTargetType =
        targetType === 'personal-manual' || targetType === 'personal-chat' ? 'personal' : targetType;

      if (!normalizedTargetType || !targetValue || !message || !scheduleAt) {
        return res.status(400).json({
          error: 'targetType, targetValue, message, and scheduleAt are required',
        });
      }

      if (!['personal', 'group'].includes(normalizedTargetType)) {
        return res.status(400).json({ error: 'targetType must be personal or group' });
      }

      const normalizedRepeatType = ['daily', 'weekly'].includes(repeatType) ? repeatType : 'none';
      const normalizedRepeatDays = Array.isArray(repeatDays)
        ? repeatDays.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
        : [];

      if (normalizedRepeatType === 'weekly' && !normalizedRepeatDays.length) {
        return res.status(400).json({ error: 'Select at least one day for a weekly repeat schedule' });
      }

      const normalizedMediaType = String(mediaType || '').trim();
      if (normalizedMediaType && normalizedMediaType !== 'none') {
        const allowedMedia = new Set(customCommandStore.ALLOWED_MEDIA_TYPES);
        if (!allowedMedia.has(normalizedMediaType)) {
          return res.status(400).json({ error: 'Invalid media type' });
        }
        if (!String(mediaUrl || '').trim()) {
          return res.status(400).json({ error: 'mediaUrl is required when mediaType is set' });
        }
      }

      const parsed = parseClientLocalDateTime(scheduleAt, timezoneOffsetMinutes);
      if (!parsed.isValid()) {
        return res.status(400).json({
          error: 'Invalid scheduleAt format',
        });
      }

      const created = await scheduleStore.createSchedule({
        targetType: normalizedTargetType,
        targetValue,
        message,
        scheduleAt: parsed.toISOString(),
        repeatType: normalizedRepeatType,
        repeatDays: normalizedRepeatDays,
        mediaType: normalizedMediaType,
        mediaUrl: String(mediaUrl || '').trim(),
        fileName: String(fileName || '').trim(),
      });

      return res.status(201).json(created);
    } catch (error) {
      return next(error);
    }
  });

  router.post('/api/messages/send', async (req, res) => {
    try {
      const { targetType, targetValue, message, mediaType, mediaUrl, fileName } = req.body || {};
      const normalizedTargetType =
        targetType === 'personal-manual' || targetType === 'personal-chat' ? 'personal' : targetType;
      const normalizedMessage = String(message || '').trim();
      const normalizedMediaType = String(mediaType || '').trim();
      const normalizedMediaUrl = String(mediaUrl || '').trim();
      const normalizedFileName = String(fileName || '').trim();

      if (!normalizedTargetType || !targetValue || (!normalizedMessage && !(normalizedMediaType && normalizedMediaType !== 'none' && normalizedMediaUrl))) {
        return res.status(400).json({
          error: 'targetType, targetValue, and either a message or media are required',
        });
      }

      if (!['personal', 'group'].includes(normalizedTargetType)) {
        return res.status(400).json({ error: 'targetType must be personal or group' });
      }

      const allowedMedia = new Set(customCommandStore.ALLOWED_MEDIA_TYPES);
      if (normalizedMediaType && normalizedMediaType !== 'none' && !allowedMedia.has(normalizedMediaType)) {
        return res.status(400).json({ error: 'Invalid media type' });
      }

      const media = normalizedMediaType && normalizedMediaType !== 'none' && normalizedMediaUrl
        ? {
            mediaType: normalizedMediaType,
            mediaUrl: normalizedMediaUrl,
            fileName: normalizedFileName || undefined,
          }
        : null;

      await whatsappService.sendMessage(
        normalizedTargetType,
        String(targetValue).trim(),
        normalizedMessage,
        media
      );

      return res.status(200).json({ ok: true });
    } catch (error) {
      const status = error.message === 'WhatsApp client is not ready' ? 409 : 400;
      return res.status(status).json({ error: error.message || 'Failed to send message' });
    }
  });

  router.delete('/api/schedules/:id', async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
      }

      const deleted = await scheduleStore.removeSchedule(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  });

  router.get('/api/deleted-messages', (req, res) => {
    return res.json({ messages: deletedMessageStore.listRecords() });
  });

  router.delete('/api/deleted-messages/:id', (req, res) => {
    const removed = deletedMessageStore.removeRecord(req.params.id);
    if (!removed) {
      return res.status(404).json({ error: 'Record not found' });
    }
    return res.status(204).send();
  });

  router.delete('/api/deleted-messages', (req, res) => {
    deletedMessageStore.clearRecords();
    return res.status(204).send();
  });

  router.get('/api/whatsapp/groups', async (req, res, next) => {
    try {
      const groups = await whatsappService.listGroups();
      return res.json({ groups });
    } catch (error) {
      if (error.message === 'WhatsApp client is not ready') {
        return res.status(409).json({ error: error.message });
      }
      return next(error);
    }
  });

  router.get('/api/whatsapp/personal-chats', async (req, res, next) => {
    try {
      const chats = await whatsappService.listPersonalChats();
      return res.json({ chats });
    } catch (error) {
      if (error.message === 'WhatsApp client is not ready') {
        return res.status(409).json({ error: error.message });
      }
      return next(error);
    }
  });

  router.get('/api/whatsapp/state', (req, res) => {
    const waState = whatsappService.getConnectionState();
    return res.json(waState);
  });

  router.post('/api/whatsapp/refresh-qr', async (req, res) => {
    try {
      const state = await whatsappService.refreshQrCode();
      return res.json(state);
    } catch (error) {
      const status = error.message === 'WhatsApp is already connected' ? 409 : 400;
      return res.status(status).json({ error: error.message || 'Failed to refresh QR code' });
    }
  });

  router.get('/api/chat-response-settings', (req, res) => {
    return res.json(chatResponseSettingsStore.getSettings());
  });

  router.put('/api/chat-response-settings', (req, res) => {
    try {
      const payload = req.body || {};
      const hasPersonal = Object.prototype.hasOwnProperty.call(payload, 'personalEnabled');
      const hasGroup = Object.prototype.hasOwnProperty.call(payload, 'groupEnabled');
      const hasSelfCommand = Object.prototype.hasOwnProperty.call(payload, 'selfCommandEnabled');

      if (!hasPersonal && !hasGroup && !hasSelfCommand) {
        return res.status(400).json({ error: 'personalEnabled, groupEnabled, or selfCommandEnabled is required' });
      }

      if (hasPersonal && typeof payload.personalEnabled !== 'boolean') {
        return res.status(400).json({ error: 'personalEnabled must be a boolean' });
      }

      if (hasGroup && typeof payload.groupEnabled !== 'boolean') {
        return res.status(400).json({ error: 'groupEnabled must be a boolean' });
      }

      if (hasSelfCommand && typeof payload.selfCommandEnabled !== 'boolean') {
        return res.status(400).json({ error: 'selfCommandEnabled must be a boolean' });
      }

      const updated = chatResponseSettingsStore.updateSettings(payload);
      return res.json(updated);
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Failed to update chat response settings' });
    }
  });

  router.get('/api/built-in-commands/sch-usage', (req, res) => {
    const settings = builtInCommandSettingsStore.getSettings();
    return res.json({
      text: settings.scheduleUsageHelpText,
      buttons: settings.scheduleUsageButtons,
    });
  });

  router.get('/api/built-in-commands', (req, res) => {
    const settings = builtInCommandSettingsStore.getSettings();
    return res.json(settings);
  });

  router.put('/api/built-in-commands/sch-usage', (req, res) => {
    try {
      const payload = req.body || {};
      const hasText = Object.prototype.hasOwnProperty.call(payload, 'text');
      const hasButtons = Object.prototype.hasOwnProperty.call(payload, 'buttons');

      if (!hasText && !hasButtons) {
        return res.status(400).json({ error: 'text or buttons is required' });
      }

      const updated = builtInCommandSettingsStore.updateScheduleUsageSettings({
        scheduleUsageHelpText: hasText ? payload.text : undefined,
        scheduleUsageButtons: hasButtons ? payload.buttons : undefined,
      });
      return res.json({
        text: updated.scheduleUsageHelpText,
        buttons: updated.scheduleUsageButtons,
      });
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Failed to update .sch usage text' });
    }
  });

  router.put('/api/built-in-commands', (req, res) => {
    try {
      const payload = req.body || {};
      // Only pass through keys the client actually sent — updateSettings treats a
      // present-but-undefined key as "field was submitted", so building the object
      // with every key up front (even as `undefined`) would incorrectly require
      // every other built-in command's text whenever only one was being edited.
      const allowedKeys = [
        'scheduleUsageHelpText',
        'scheduleUsageButtons',
        'scheduleListEmptyText',
        'scheduleListButtons',
        'scheduleDeleteUsageText',
        'scheduleDeleteButtons',
        'vvUsageHelpText',
        'vvUsageButtons',
        'stickerUsageHelpText',
        'stickerUsageButtons',
        'zipUsageHelpText',
        'zipUsageButtons',
        'unzipUsageHelpText',
        'unzipUsageButtons',
        'pdf2txtUsageHelpText',
        'pdf2txtUsageButtons',
        'maketxtUsageHelpText',
        'maketxtUsageButtons',
        'qrcodeUsageHelpText',
        'qrcodeUsageButtons',
        'imagetopdfUsageHelpText',
        'imagetopdfUsageButtons',
        'ssUsageHelpText',
        'ssUsageButtons',
        'ttsUsageHelpText',
        'ttsUsageButtons',
      ];

      const updatePayload = {};
      for (const key of allowedKeys) {
        if (Object.prototype.hasOwnProperty.call(payload, key)) {
          updatePayload[key] = payload[key];
        }
      }

      if (!Object.keys(updatePayload).length) {
        return res.status(400).json({ error: 'At least one built-in setting field is required' });
      }

      const updated = builtInCommandSettingsStore.updateSettings(updatePayload);

      return res.json(updated);
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Failed to update built-in command settings' });
    }
  });

  router.get('/api/access-control-settings', (req, res) => {
    return res.json(accessControlStore.getSettings());
  });

  router.put('/api/access-control-settings', (req, res) => {
    try {
      const payload = req.body || {};
      const hasOwner = Object.prototype.hasOwnProperty.call(payload, 'ownerNumber');
      const hasMode = Object.prototype.hasOwnProperty.call(payload, 'commandMode');
      const hasTimeZone = Object.prototype.hasOwnProperty.call(payload, 'timeZone');

      if (!hasOwner && !hasMode && !hasTimeZone) {
        return res.status(400).json({ error: 'ownerNumber, commandMode, or timeZone is required' });
      }

      if (hasMode && !['public', 'private'].includes(String(payload.commandMode || '').trim().toLowerCase())) {
        return res.status(400).json({ error: 'commandMode must be public or private' });
      }

      if (hasTimeZone) {
        const rawTimeZone = String(payload.timeZone || '').trim();
        try {
          new Intl.DateTimeFormat('en-GB', { timeZone: rawTimeZone || 'UTC' }).format(new Date());
        } catch (error) {
          return res.status(400).json({ error: 'timeZone must be a valid IANA timezone (example: Asia/Kuala_Lumpur)' });
        }
      }

      const updated = accessControlStore.updateSettings(payload);
      return res.json(updated);
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Failed to update access control settings' });
    }
  });

  router.post('/api/whatsapp/pairing-code', async (req, res) => {
    try {
      const { phoneNumber } = req.body || {};
      const code = await whatsappService.requestPairingCode(phoneNumber);
      return res.json({ code });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  // ── OSINT Routes ────────────────────────────────────────────────────────────
  // Rate-limited: max 20 requests per IP per 5 minutes across all OSINT endpoints.

  router.post('/api/osint/wa-lookup', osintRateLimit, async (req, res, next) => {
    try {
      const { phone } = req.body || {};
      if (!phone) {
        return res.status(400).json({ error: 'phone is required' });
      }
      const result = await whatsappService.osintWaLookup(String(phone).trim());
      return res.json(result);
    } catch (error) {
      if (error.message === 'WhatsApp client is not ready') {
        return res.status(409).json({ error: 'WhatsApp is not connected. Please connect first.' });
      }
      return next(error);
    }
  });

  router.get('/api/osint/phone-info', osintRateLimit, async (req, res, next) => {
    try {
      const { number } = req.query;
      if (!number) {
        return res.status(400).json({ error: 'number query param is required' });
      }
      const result = await osintParsePhoneNumber(String(number).trim());
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.get('/api/osint/group-info', osintRateLimit, async (req, res, next) => {
    try {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'id query param is required' });
      }
      const result = await whatsappService.osintGroupInfo(String(id).trim());
      return res.json(result);
    } catch (error) {
      if (error.message === 'WhatsApp client is not ready') {
        return res.status(409).json({ error: 'WhatsApp is not connected. Please connect first.' });
      }
      return next(error);
    }
  });

  router.get('/api/osint/ip-info', osintRateLimit, async (req, res, next) => {
    try {
      const { query } = req.query;
      if (!query) {
        return res.status(400).json({ error: 'query param is required' });
      }
      const result = await osintIpLookup(String(query).trim());
      if (!result.success) {
        return res.status(502).json({ error: result.error || 'IP lookup failed' });
      }
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

// ── OSINT Helpers ─────────────────────────────────────────────────────────────

// Simple in-memory rate limiter: 20 requests per IP per 5 minutes.
const _osintRateBuckets = new Map();
const OSINT_RATE_LIMIT = 20;
const OSINT_RATE_WINDOW_MS = 5 * 60 * 1000;

function osintRateLimit(req, res, next) {
  const ip = String(req.ip || req.socket?.remoteAddress || 'unknown');
  const now = Date.now();
  const bucket = _osintRateBuckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    _osintRateBuckets.set(ip, { count: 1, resetAt: now + OSINT_RATE_WINDOW_MS });
    return next();
  }

  if (bucket.count >= OSINT_RATE_LIMIT) {
    const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader('Retry-After', retryAfterSec);
    return res.status(429).json({
      error: `Too many requests. Please wait ${retryAfterSec} seconds before trying again.`,
    });
  }

  bucket.count += 1;
  return next();
}

async function osintParsePhoneNumber(raw) {
  // Strip common formatting
  const cleaned = raw.replace(/[\s\-().+]/g, '');
  const withPlus = raw.trim().startsWith('+') ? `+${cleaned}` : cleaned;

  // Country code map (most common dial codes)
  const countryCodes = {
    '1': { country: 'United States / Canada', code: '+1' },
    '7': { country: 'Russia', code: '+7' },
    '20': { country: 'Egypt', code: '+20' },
    '27': { country: 'South Africa', code: '+27' },
    '30': { country: 'Greece', code: '+30' },
    '31': { country: 'Netherlands', code: '+31' },
    '32': { country: 'Belgium', code: '+32' },
    '33': { country: 'France', code: '+33' },
    '34': { country: 'Spain', code: '+34' },
    '39': { country: 'Italy', code: '+39' },
    '40': { country: 'Romania', code: '+40' },
    '41': { country: 'Switzerland', code: '+41' },
    '43': { country: 'Austria', code: '+43' },
    '44': { country: 'United Kingdom', code: '+44' },
    '45': { country: 'Denmark', code: '+45' },
    '46': { country: 'Sweden', code: '+46' },
    '47': { country: 'Norway', code: '+47' },
    '48': { country: 'Poland', code: '+48' },
    '49': { country: 'Germany', code: '+49' },
    '51': { country: 'Peru', code: '+51' },
    '52': { country: 'Mexico', code: '+52' },
    '54': { country: 'Argentina', code: '+54' },
    '55': { country: 'Brazil', code: '+55' },
    '56': { country: 'Chile', code: '+56' },
    '57': { country: 'Colombia', code: '+57' },
    '58': { country: 'Venezuela', code: '+58' },
    '60': { country: 'Malaysia', code: '+60' },
    '61': { country: 'Australia', code: '+61' },
    '62': { country: 'Indonesia', code: '+62' },
    '63': { country: 'Philippines', code: '+63' },
    '64': { country: 'New Zealand', code: '+64' },
    '65': { country: 'Singapore', code: '+65' },
    '66': { country: 'Thailand', code: '+66' },
    '81': { country: 'Japan', code: '+81' },
    '82': { country: 'South Korea', code: '+82' },
    '84': { country: 'Vietnam', code: '+84' },
    '86': { country: 'China', code: '+86' },
    '90': { country: 'Turkey', code: '+90' },
    '91': { country: 'India', code: '+91' },
    '92': { country: 'Pakistan', code: '+92' },
    '93': { country: 'Afghanistan', code: '+93' },
    '94': { country: 'Sri Lanka', code: '+94' },
    '95': { country: 'Myanmar', code: '+95' },
    '98': { country: 'Iran', code: '+98' },
    '212': { country: 'Morocco', code: '+212' },
    '213': { country: 'Algeria', code: '+213' },
    '216': { country: 'Tunisia', code: '+216' },
    '218': { country: 'Libya', code: '+218' },
    '220': { country: 'Gambia', code: '+220' },
    '221': { country: 'Senegal', code: '+221' },
    '234': { country: 'Nigeria', code: '+234' },
    '254': { country: 'Kenya', code: '+254' },
    '255': { country: 'Tanzania', code: '+255' },
    '256': { country: 'Uganda', code: '+256' },
    '260': { country: 'Zambia', code: '+260' },
    '263': { country: 'Zimbabwe', code: '+263' },
    '351': { country: 'Portugal', code: '+351' },
    '352': { country: 'Luxembourg', code: '+352' },
    '353': { country: 'Ireland', code: '+353' },
    '354': { country: 'Iceland', code: '+354' },
    '358': { country: 'Finland', code: '+358' },
    '380': { country: 'Ukraine', code: '+380' },
    '385': { country: 'Croatia', code: '+385' },
    '386': { country: 'Slovenia', code: '+386' },
    '420': { country: 'Czech Republic', code: '+420' },
    '421': { country: 'Slovakia', code: '+421' },
    '855': { country: 'Cambodia', code: '+855' },
    '880': { country: 'Bangladesh', code: '+880' },
    '886': { country: 'Taiwan', code: '+886' },
    '960': { country: 'Maldives', code: '+960' },
    '966': { country: 'Saudi Arabia', code: '+966' },
    '971': { country: 'UAE', code: '+971' },
    '972': { country: 'Israel', code: '+972' },
    '973': { country: 'Bahrain', code: '+973' },
    '974': { country: 'Qatar', code: '+974' },
    '977': { country: 'Nepal', code: '+977' },
  };

  if (!cleaned || !/^\d+$/.test(cleaned)) {
    return { valid: false, error: 'Invalid phone number format' };
  }

  let countryInfo = null;
  let localNumber = cleaned;

  // Try 3-digit then 2-digit then 1-digit country code
  for (const len of [3, 2, 1]) {
    const prefix = cleaned.slice(0, len);
    if (countryCodes[prefix]) {
      countryInfo = countryCodes[prefix];
      localNumber = cleaned.slice(len);
      break;
    }
  }

  const intlFormat = `+${cleaned}`;
  const isLikelyMobile = localNumber.startsWith('1') || localNumber.startsWith('0') || localNumber.startsWith('8') || localNumber.startsWith('9');

  return {
    valid: cleaned.length >= 7 && cleaned.length <= 15,
    number: cleaned,
    intlFormat,
    localFormat: `0${localNumber}`,
    country: countryInfo?.country || 'Unknown',
    countryCode: countryInfo?.code || `+${cleaned.slice(0, 2)}`,
    lineType: isLikelyMobile ? 'Mobile (estimated)' : 'Unknown',
    carrier: 'Not available (no carrier API configured)',
    note: 'Country and line type are estimated from dial code. Carrier lookup requires a paid API.',
  };
}

async function osintIpLookup(query) {
  try {
    const { default: fetch } = await import('node-fetch').catch(() => ({ default: globalThis.fetch }));
    const fetchFn = fetch || globalThis.fetch;

    // ipinfo.io — free tier, HTTPS supported, no API key required for basic lookups.
    // Accepts both IPv4 addresses and domain names.
    const url = `https://ipinfo.io/${encodeURIComponent(query)}/json`;
    const res = await fetchFn(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { success: false, error: `Provider returned HTTP ${res.status}${body ? `: ${body.slice(0, 120)}` : ''}` };
    }

    const data = await res.json();

    // ipinfo.io returns { ip, hostname, city, region, country, loc, org, postal, timezone }
    // "loc" is "lat,lon" string; "org" is "AS#### OrgName"
    const [lat, lon] = (data.loc || '').split(',');
    const coordinates = lat && lon ? `${lat}, ${lon}` : null;

    return {
      success: true,
      query: data.ip || query,
      country: data.country || null,
      region: data.region || null,
      city: data.city || null,
      coordinates,
      timezone: data.timezone || null,
      isp: data.org || null,
      org: data.org || null,
      as: data.org ? data.org.split(' ')[0] : null,
      hostname: data.hostname || null,
      postal: data.postal || null,
    };
  } catch (error) {
    return { success: false, error: `Lookup failed: ${error.message}` };
  }
}

module.exports = createDashboardRouter;
