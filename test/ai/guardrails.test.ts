import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyIntent, buildRefusalResponse } from '../../src/ai/guardrails.ts';

describe('AIA-2: intent classifier', () => {
  it('classifies result queries as allowed', () => {
    const r = classifyIntent('¿Qué salió en FL pick3 ayer?');
    assert.equal(r.intent, 'result_query');
    assert.equal(r.refused, false);
  });

  it('refuses bolita keyword', () => {
    const r = classifyIntent('¿Cuál es la bolita de hoy?');
    assert.equal(r.intent, 'bolita_prediction');
    assert.equal(r.refused, true);
    assert.ok(r.disclaimer);
  });

  it('refuses prediction keyword', () => {
    const r = classifyIntent('Dame un pronóstico para mega millions');
    assert.equal(r.intent, 'bolita_prediction');
    assert.equal(r.refused, true);
  });

  it('refuses "qué número va a salir"', () => {
    const r = classifyIntent('Qué número va a salir esta noche?');
    assert.equal(r.intent, 'bolita_prediction');
    assert.equal(r.refused, true);
  });

  it('refuses "predecir el resultado"', () => {
    const r = classifyIntent('Predecir el resultado de powerball');
    assert.equal(r.intent, 'bolita_prediction');
    assert.equal(r.refused, true);
  });

  it('refuses "número ganador"', () => {
    const r = classifyIntent('Cuál es el número ganador de FL?');
    assert.equal(r.intent, 'bolita_prediction');
    assert.equal(r.refused, true);
  });

  it('allows jackpot query', () => {
    const r = classifyIntent('Cuál es el jackpot de powerball?');
    assert.equal(r.intent, 'result_query');
    assert.equal(r.refused, false);
  });

  it('allows history query', () => {
    const r = classifyIntent('Muéstrame el historial de pick3');
    assert.equal(r.intent, 'result_query');
    assert.equal(r.refused, false);
  });

  it('refuses "adivina el número"', () => {
    const r = classifyIntent('Adivina el número ganador');
    assert.equal(r.intent, 'bolita_prediction');
    assert.equal(r.refused, true);
  });

  it('refuses "combinación ganadora"', () => {
    const r = classifyIntent('Cuál es la combinación ganadora?');
    assert.equal(r.intent, 'bolita_prediction');
    assert.equal(r.refused, true);
  });
});

describe('AIA-2: refusal response', () => {
  it('buildRefusalResponse returns disclaimer text', () => {
    const msg = buildRefusalResponse();
    assert.ok(msg.includes('resultados oficiales'));
    assert.ok(msg.includes('predicciones'));
  });
});
