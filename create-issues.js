const fs = require('fs');
const yaml = require('js-yaml');
const fetch = require('node-fetch');
require('dotenv').config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'baptt123';
const REPO = 'JobSeekerBackend';
const YAML_FILE = 'issues.yaml';

if (!GITHUB_TOKEN) {
  console.error('Vui lòng set biến môi trường GITHUB_TOKEN');
  process.exit(1);
}

async function fetchMilestones() {
  console.log(`Đang lấy milestones từ repo ${OWNER}/${REPO}...`);
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/milestones?state=all`, {
    headers: { Authorization: `token ${GITHUB_TOKEN}` }
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Lỗi lấy milestone: ${res.status} - ${errBody}`);
  }
  const data = await res.json();
  console.log(`Lấy được ${data.length} milestones.`);
  return data;
}

async function createIssue(issue, milestoneId) {
  console.log(`Tạo issue: "${issue.title}" với milestone ID: ${milestoneId || 'null'}`);
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
    },
    body: JSON.stringify({
      title: issue.title,
      body: issue.body,
      labels: issue.labels,
      milestone: milestoneId || undefined,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Lỗi tạo issue: ${res.status} - ${err}`);
  }
  return await res.json();
}

function loadIssuesFromYaml() {
  console.log(`Đọc file YAML từ: ${YAML_FILE}`);
  const file = fs.readFileSync(YAML_FILE, 'utf8');
  const data = yaml.load(file);
  if (!data.issues || !Array.isArray(data.issues)) {
    throw new Error('File YAML thiếu "issues" array');
  }
  return data.issues;
}

async function main() {
  try {
    // In kiểm tra token và repo
    console.log('Đã load GitHub Token:', !!GITHUB_TOKEN);
    console.log('Repo:', `${OWNER}/${REPO}`);

    const milestones = await fetchMilestones();
    const milestoneMap = new Map(milestones.map(m => [m.title, m.number]));

    const issues = loadIssuesFromYaml();

    for (const issue of issues) {
      const milestoneId = milestoneMap.get(issue.milestone);
      const milestoneText = issue.milestone ? `"${issue.milestone}"` : 'null';
      console.log(`\nXử lý issue: "${issue.title}" (milestone: ${milestoneText} -> ID: ${milestoneId || 'null'})`);
      const created = await createIssue(issue, milestoneId);
      console.log(`-> Tạo thành công issue #${created.number}`);
    }
    console.log('Hoàn thành tạo tất cả issues!');
  } catch (err) {
    console.error('Lỗi:', err.message);
  }
}

main();
