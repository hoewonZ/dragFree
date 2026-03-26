import test from "node:test";
import assert from "node:assert/strict";

import { HoverExpandController } from "../../src/renderer/hover-expand-controller.js";

function createFakeTimers() {
  let nextId = 1;
  const tasks = new Map();

  return {
    setTimer(callback) {
      const id = nextId;
      nextId += 1;
      tasks.set(id, callback);
      return id;
    },
    clearTimer(id) {
      tasks.delete(id);
    },
    runAll() {
      const callbacks = [...tasks.values()];
      tasks.clear();
      for (const callback of callbacks) {
        callback();
      }
    }
  };
}

test("hover start emits immediate feedback", () => {
  const feedback = [];
  const expand = [];
  const fakeTimers = createFakeTimers();
  const controller = new HoverExpandController({
    delayMs: 1500,
    setTimer: (callback) => fakeTimers.setTimer(callback),
    clearTimer: (id) => fakeTimers.clearTimer(id)
  });

  controller.startHover("folder-a", {
    onFeedback: (folderId) => feedback.push(folderId),
    onExpand: (folderId) => expand.push(folderId)
  });

  assert.deepEqual(feedback, ["folder-a"]);
  assert.deepEqual(expand, []);
});

test("hover delay triggers expand", () => {
  const feedback = [];
  const expand = [];
  const fakeTimers = createFakeTimers();
  const controller = new HoverExpandController({
    delayMs: 1500,
    setTimer: (callback) => fakeTimers.setTimer(callback),
    clearTimer: (id) => fakeTimers.clearTimer(id)
  });

  controller.startHover("folder-b", {
    onFeedback: (folderId) => feedback.push(folderId),
    onExpand: (folderId) => expand.push(folderId)
  });

  fakeTimers.runAll();

  assert.deepEqual(feedback, ["folder-b"]);
  assert.deepEqual(expand, ["folder-b"]);
});

test("supports immediate expand when delay is zero", () => {
  const feedback = [];
  const expand = [];
  const fakeTimers = createFakeTimers();
  const controller = new HoverExpandController({
    delayMs: 0,
    setTimer: (callback) => fakeTimers.setTimer(callback),
    clearTimer: (id) => fakeTimers.clearTimer(id)
  });

  controller.startHover("folder-zero", {
    onFeedback: (folderId) => feedback.push(folderId),
    onExpand: (folderId) => expand.push(folderId)
  });

  fakeTimers.runAll();

  assert.deepEqual(feedback, ["folder-zero"]);
  assert.deepEqual(expand, ["folder-zero"]);
});

test("switching hover target cancels previous expansion", () => {
  const expand = [];
  const fakeTimers = createFakeTimers();
  const controller = new HoverExpandController({
    delayMs: 1500,
    setTimer: (callback) => fakeTimers.setTimer(callback),
    clearTimer: (id) => fakeTimers.clearTimer(id)
  });

  controller.startHover("folder-a", {
    onFeedback: () => {},
    onExpand: (folderId) => expand.push(folderId)
  });

  controller.startHover("folder-b", {
    onFeedback: () => {},
    onExpand: (folderId) => expand.push(folderId)
  });

  fakeTimers.runAll();

  assert.deepEqual(expand, ["folder-b"]);
});
