// GitHub Actions status for the Romly repo without the gh CLI (not installed here).
// Usage: node .claude/skills/romly-ship/gh-runs.mjs           recent runs
//        node .claude/skills/romly-ship/gh-runs.mjs <run-id>  jobs and steps of one run
// Uses the public REST API without a token (60 requests per hour per IP; the repo must stay public).
const REPO = 'AlanShukur/Oppusings-prosjekt';
const get = async path => {
  const response = await fetch(`https://api.github.com/repos/${REPO}/${path}`, {headers: {accept: 'application/vnd.github+json', 'user-agent': 'romly-skill'}});
  const body = await response.json();
  if (!response.ok) throw Error(`${response.status} ${body.message || ''}`.trim());
  return body;
};
const time = value => value ? value.slice(11, 19) : '        ';
const runId = process.argv[2];

if (!runId) {
  const {workflow_runs: runs} = await get('actions/runs?per_page=10');
  for (const r of runs) {
    console.log([r.id, r.name.padEnd(7), r.event.padEnd(17), r.head_branch.padEnd(24), r.head_sha.slice(0, 7), `attempt ${r.run_attempt}`,
      r.status.padEnd(11), (r.conclusion || '').padEnd(9), r.created_at.replace('T', ' ').slice(0, 16)].join('  '));
  }
} else {
  const run = await get(`actions/runs/${runId}`);
  console.log(`${run.name} #${run.run_number} attempt ${run.run_attempt}: ${run.status} ${run.conclusion || ''} — ${run.head_branch} ${run.head_sha.slice(0, 7)} (${run.event})`);
  console.log(run.html_url);
  const {jobs} = await get(`actions/runs/${runId}/jobs`);
  for (const job of jobs) {
    console.log(`\njob: ${job.name} — ${job.status} ${job.conclusion || ''}`);
    for (const step of job.steps || []) console.log(`  ${(step.conclusion || step.status).padEnd(11)} ${time(step.started_at)}  ${step.name}`);
  }
}
