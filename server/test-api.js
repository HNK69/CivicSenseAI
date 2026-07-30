const axios = require('axios');
const mongoose = require('mongoose');
const Officer = require('./src/models/Officer');

const API = 'http://localhost:5000/api';
require('dotenv').config();

async function runTests() {
  console.log('--- STARTING BACKEND VERIFICATION TESTS ---\n');
  let userToken = '';
  let officerToken = '';
  let issueId = '';
  let workOrderId = '';

  try {
    // Connect DB to seed officer
    await mongoose.connect(process.env.MONGO_URI);
    
    // Cleanup for clean test
    await mongoose.connection.db.dropDatabase();
    console.log('[DB] Database reset for clean test.');

    // 1. Citizen Authentication
    console.log('\n[TEST] Registering Citizen...');
    const regRes = await axios.post(`${API}/auth/register`, {
      name: 'John Citizen',
      email: 'john@example.com',
      password: 'password123',
    });
    userToken = regRes.data.data.accessToken;
    console.log('✅ Citizen registered successfully.');

    // 2. Citizen Profile
    console.log('\n[TEST] Fetching Citizen Profile...');
    const profRes = await axios.get(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    console.log(`✅ Citizen Profile fetched: ${profRes.data.data.user.name}`);

    // 3. Issue Creation (Issue CRUD & GPS)
    console.log('\n[TEST] Citizen Creating an Issue...');
    const issueRes = await axios.post(`${API}/issues`, {
      title: 'Pothole on Main St',
      description: 'Huge pothole causing traffic issues, needs immediate fixing.',
      category: 'Roads',
      latitude: 12.9716,
      longitude: 77.5946
    }, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    issueId = issueRes.data.data.issue._id;
    console.log(`✅ Issue created successfully! ID: ${issueId}`);
    // Wait for AI stubs to execute in background
    await new Promise(res => setTimeout(res, 500));

    // 4. Officer Creation & Login
    console.log('\n[TEST] Creating & Logging in Officer...');
    await Officer.create({
      name: 'Jane Officer',
      email: 'jane@civicsense.ai',
      passwordHash: 'officer123',
      role: 'admin',
      department: 'PWD'
    });
    
    const officerLogin = await axios.post(`${API}/officer/auth/login`, {
      email: 'jane@civicsense.ai',
      password: 'officer123'
    });
    officerToken = officerLogin.data.data.accessToken;
    console.log(`✅ Officer logged in successfully! Role: ${officerLogin.data.data.officer.role}`);

    // 5. Officer gets issues
    console.log('\n[TEST] Officer fetching Issues...');
    const issuesRes = await axios.get(`${API}/officer/issues`, {
      headers: { Authorization: `Bearer ${officerToken}` }
    });
    console.log(`✅ Officer retrieved ${issuesRes.data.data.length} issues.`);

    // 6. Officer assigns Issue to Work Order
    console.log('\n[TEST] Officer creating Work Order from Issue...');
    const woRes = await axios.post(`${API}/officer/work-orders`, {
      issueId: issueId,
      department: 'PWD',
      assignedTo: officerLogin.data.data.officer._id
    }, {
      headers: { Authorization: `Bearer ${officerToken}` }
    });
    workOrderId = woRes.data.data.workOrder._id;
    console.log(`✅ Work Order created! ID: ${workOrderId}`);

    // 7. Test AI service endpoints (Stubs)
    console.log('\n[TEST] Hitting AI stubs...');
    const aiRes = await axios.post(`${API}/officer/ai/analyze/${issueId}`, {}, {
      headers: { Authorization: `Bearer ${officerToken}` }
    });
    console.log(`✅ AI Investigation triggered. Stub response summary: "${aiRes.data.data.result.summary}"`);

    // 8. Test duplicate merge (Stub support)
    console.log('\n[TEST] Hitting Duplicates API...');
    const dupRes = await axios.get(`${API}/officer/duplicates`, {
      headers: { Authorization: `Bearer ${officerToken}` }
    });
    console.log(`✅ Duplicates fetched. Count: ${dupRes.data.data.groups.length}`);

    console.log('\n🎉 ALL BACKEND FEATURES VERIFIED SUCCESSFULLY! 🎉');

  } catch (err) {
    console.error('\n❌ Test Failed:');
    if (err.response) {
      console.error(err.response.data);
    } else {
      console.error(err.message);
    }
  } finally {
    mongoose.disconnect();
  }
}

runTests();
