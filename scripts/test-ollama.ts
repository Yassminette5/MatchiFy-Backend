#!/usr/bin/env ts-node

/**
 * Script de test pour vérifier la connexion et les performances d'Ollama
 * Usage: npx ts-node scripts/test-ollama.ts
 */

const OLLAMA_URL = process.env.AI_LOCAL_URL || 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = process.env.AI_MODEL || 'llama3.1';
const BASE_URL = OLLAMA_URL.includes('/api/generate')
  ? OLLAMA_URL.replace('/api/generate', '')
  : OLLAMA_URL.replace(/\/[^/]*$/, '');

async function testHealthCheck(): Promise<boolean> {
  console.log('\n🔍 Testing Ollama Health Check...');
  console.log(`   URL: ${BASE_URL}/api/tags`);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${BASE_URL}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ Health check passed`);
      console.log(`   📦 Available models: ${data.models?.length || 0}`);
      if (data.models && data.models.length > 0) {
        data.models.forEach((model: any) => {
          console.log(`      - ${model.name} (${(model.size / 1024 / 1024 / 1024).toFixed(2)} GB)`);
        });
      }
      return true;
    } else {
      console.log(`   ❌ Health check failed: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log(`   ❌ Health check timed out after 5s`);
    } else {
      console.log(`   ❌ Health check error: ${error.message}`);
    }
    return false;
  }
}

async function testGenerateRequest(): Promise<boolean> {
  console.log('\n🧪 Testing Ollama Generate Request...');
  console.log(`   URL: ${OLLAMA_URL}`);
  console.log(`   Model: ${OLLAMA_MODEL}`);
  
  const testPrompt = 'Say "Hello, Ollama is working!" in one sentence.';
  const requestBody = {
    model: OLLAMA_MODEL,
    prompt: testPrompt,
    stream: false,
  };
  
  try {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
    
    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    const elapsed = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      const responseText = data.response || '';
      console.log(`   ✅ Generate request succeeded in ${elapsed}ms`);
      console.log(`   📝 Response: ${responseText.substring(0, 100)}...`);
      if (data.prompt_eval_count) {
        console.log(`   📊 Tokens: ${data.prompt_eval_count} prompt + ${data.eval_count || 0} completion`);
      }
      return true;
    } else {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.log(`   ❌ Generate request failed: ${response.status} ${response.statusText}`);
      console.log(`   Error: ${errorText.substring(0, 200)}`);
      return false;
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log(`   ❌ Generate request timed out after 30s`);
    } else {
      console.log(`   ❌ Generate request error: ${error.message}`);
    }
    return false;
  }
}

async function testPerformance(): Promise<void> {
  console.log('\n⚡ Testing Ollama Performance...');
  console.log(`   Running 3 quick requests to measure average response time...`);
  
  const testPrompt = 'Count from 1 to 5.';
  const requestBody = {
    model: OLLAMA_MODEL,
    prompt: testPrompt,
    stream: false,
  };
  
  const times: number[] = [];
  
  for (let i = 1; i <= 3; i++) {
    try {
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout per request
      
      const response = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      const elapsed = Date.now() - startTime;
      
      if (response.ok) {
        times.push(elapsed);
        console.log(`   Request ${i}/3: ${elapsed}ms ✅`);
      } else {
        console.log(`   Request ${i}/3: Failed (${response.status}) ❌`);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log(`   Request ${i}/3: Timed out ❌`);
      } else {
        console.log(`   Request ${i}/3: Error - ${error.message} ❌`);
      }
    }
    
    // Wait a bit between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  if (times.length > 0) {
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    console.log(`\n   📊 Performance Summary:`);
    console.log(`      Average: ${Math.round(avg)}ms`);
    console.log(`      Min: ${min}ms`);
    console.log(`      Max: ${max}ms`);
    
    if (avg > 10000) {
      console.log(`   ⚠️  Warning: Average response time is high (>10s). Ollama may be slow.`);
    } else if (avg > 5000) {
      console.log(`   ⚠️  Warning: Average response time is moderate (>5s). Consider optimizing.`);
    } else {
      console.log(`   ✅ Performance is good (<5s average)`);
    }
  }
}

async function main() {
  console.log('🚀 Ollama Connection Test');
  console.log('='.repeat(50));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Generate URL: ${OLLAMA_URL}`);
  console.log(`Model: ${OLLAMA_MODEL}`);
  
  const healthOk = await testHealthCheck();
  
  if (!healthOk) {
    console.log('\n❌ Health check failed. Please ensure:');
    console.log('   1. Ollama is running: ollama serve');
    console.log('   2. The model is installed: ollama pull ' + OLLAMA_MODEL);
    console.log('   3. The URL is correct: ' + BASE_URL);
    process.exit(1);
  }
  
  const generateOk = await testGenerateRequest();
  
  if (!generateOk) {
    console.log('\n❌ Generate request failed. Please check:');
    console.log('   1. The model is available: ollama list');
    console.log('   2. The URL is correct: ' + OLLAMA_URL);
    process.exit(1);
  }
  
  await testPerformance();
  
  console.log('\n✅ All tests passed! Ollama is working correctly.');
  console.log('='.repeat(50));
}

main().catch((error) => {
  console.error('\n❌ Test script error:', error);
  process.exit(1);
});

