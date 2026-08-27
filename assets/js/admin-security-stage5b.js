document.addEventListener('cp-admin-ready',async()=>{
 const {sb,orgId}=window.CP_ADMIN;
 const [ov,rows]=await Promise.all([sb.rpc('org_admin_security_overview',{p_org:orgId}),sb.rpc('org_admin_security_readiness',{p_org:orgId})]);
 if(ov.error||rows.error){securityMessage.innerHTML='<div class="state-banner error">Security readiness could not be loaded.</div>';return}
 const o=ov.data||{};
 securityKpis.innerHTML=[['Local accounts',o.accounts||0],['Blocked requests · 24h',o.blocked_24h||0],['Blocked requests · 30d',o.blocked_30d||0],['Audit events · 30d',o.audit_30d||0],['Server CAPTCHA active',o.captcha_server_verified||0]].map(x=>`<div class="admin-kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
 securityRows.innerHTML=(rows.data||[]).map(x=>`<tr><td><a href="admin-account.html?id=${x.account_id}"><strong>${x.account_name}</strong></a></td><td><strong>${x.readiness_score}%</strong></td><td>${x.live_content}</td><td>${x.connected_domains?`${x.https_domains}/${x.connected_domains} HTTPS`:'None'}</td><td>${x.privacy_banner?'On':'Off'}</td><td>${x.imprint_complete?'Complete':'Missing'}</td><td>${x.bot_filtering?'On':'Off'}</td><td>${x.captcha_server_verified?'Active':'Pending host'}</td><td>${x.blocked_requests_30d}</td></tr>`).join('');
});