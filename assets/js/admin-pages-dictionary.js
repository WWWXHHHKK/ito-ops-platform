/* ─────────────────────────────────────────────
   pages · dictionary & custom field definitions
   ───────────────────────────────────────────── */

(function () {
  'use strict';

  const P = (window.ITO_PAGES = window.ITO_PAGES || {});
  const D = window.ITO_DATA;

  function S() { return ITO.state; }
  function U() { return ITO.ui; }

  const FIELD_MODULES = [
    { key: 'overhaulAction', name: '大修行动', ready: true },
    { key: 'overhaulMaterial', name: '大修物资', ready: true },
    { key: 'overhaulPerson', name: '大修人员', ready: true },
    { key: 'task', name: '任务', ready: true },
    { key: 'inspectionPlan', name: '巡检计划', ready: true },
    { key: 'inspectionRecord', name: '巡检记录', ready: true },
    { key: 'maintenancePlan', name: '维保计划', ready: true },
    { key: 'maintenanceRecord', name: '维保记录', ready: true },
    { key: 'duty', name: '值班', ready: true }
  ];

  const FIELD_TYPES = [
    ['text', '单行文本'], ['textarea', '多行文本'], ['number', '数字'], ['amount', '金额'],
    ['date', '日期'], ['datetime', '日期时间'], ['select', '单选'], ['multiselect', '多选'],
    ['switch', '开关'], ['person', '人员'], ['attachment', '附件'], ['link', '链接']
  ];

  const FIELD_GROUPS = ['基本信息', '扩展信息', '交付信息', '采购信息', '人员信息', '计划信息', '记录信息', '值班信息'];
  const ROLE_OPTIONS = [['employee', '员工'], ['manager', '主管'], ['leader', '领导'], ['admin', '管理员']];

  function dicts() { return S().dictionaries || []; }

  function dictionaryRoleTag() {
    return ITO.roleIs('admin') ? '仅系统管理员可配置' : '已由角色权限开放';
  }
  function fields() { return S().fieldDefs || []; }
  function dictById(id) { return dicts().find(function (d) { return d.id === id; }); }

  function readOnlyInfo(d) {
    const route = d.sourceRoute || '';
    return {
      hint: d.readOnlyHint || '系统流程固定，不开放配置',
      route: route,
      routeName: route && ITO.routes ? ITO.routes[route] : '',
      accessible: !!(route && ITO.can && ITO.can(route))
    };
  }

  function usageCount(dict, name) {
    const st = S();
    const rows = function (list) { return list || []; };
    if (dict.id === 'overhaulBase') {
      if (ITO.normalizeOverhaulPersonnel && st.overhaul) ITO.normalizeOverhaulPersonnel(st.overhaul);
      return rows((st.overhaul || {}).personnel).filter(function (r) {
        if (Array.isArray(r)) {
          const raw = String(r[8] || '');
          const base = /惠州|A地区/.test(raw) ? 'A地区' : (/防城港|B地区/.test(raw) ? 'B地区' : raw);
          return base === name;
        }
        return r.base === name;
      }).length;
    }
    if (dict.id === 'overhaulCat') return rows((st.overhaul || {}).items).filter(function (r) { return r.cat === name; }).length;
    if (dict.id === 'overhaulPhase') return rows((st.overhaul || {}).items).filter(function (r) { return r.phase === name; }).length;
    if (dict.id === 'overhaulPrio') return rows((st.overhaul || {}).items).filter(function (r) { return r.prio === name; }).length;
    if (dict.id === 'personType') {
      if (ITO.normalizeOverhaulPersonnel && st.overhaul) ITO.normalizeOverhaulPersonnel(st.overhaul);
      return rows((st.overhaul || {}).personnel).filter(function (r) {
        if (Array.isArray(r)) return false;
        return name === '技术工人' ? (Number(r.tech) || 0) > 0 : (Number(r.aux) || 0) > 0;
      }).length;
    }
    if (dict.id === 'personTitle') return rows(st.staff).filter(function (r) { return r.title === name; }).length;
    if (dict.id === 'group') return rows(st.staff).filter(function (r) {
      const g = rows(st.groups).find(function (x) { return x.id === r.group; });
      return g && g.name === name;
    }).length;
    if (dict.id === 'inspectionCycle') return rows(st.inspectionPlans).filter(function (r) { return r.cycle === name; }).length;
    if (dict.id === 'maintenanceCycle') return rows(st.maintenancePlans).filter(function (r) { return r.cycle === name; }).length;
    if (dict.id === 'maintenanceVendor') return rows(st.maintenancePlans).filter(function (r) { return r.vendor === name; }).length;
    if (dict.id === 'taskStatus') {
      let n = 0;
      rows(st.tasks).forEach(function (t) { rows(t.subs).forEach(function (s) { if (s.status === name) n += 1; }); });
      rows(st.planTasks).forEach(function (t) { if (t.status === name) n += 1; });
      return n;
    }
    if (dict.id === 'authType') return rows(st.auths).filter(function (a) { return a.type === name; }).length;
    if (dict.id === 'dutyStatus') {
      const hs = ITO.dutyHandovers ? ITO.dutyHandovers() : [];
      return rows(hs).filter(function (h) { return h.status === name; }).length;
    }
    if (dict.id === 'messageType') return rows(st.messages).filter(function (m) { return m.type === name; }).length;
    return 0;
  }

  function fieldScope(f) {
    return f.scope || 'main';
  }

  function fieldRecords(module, scope) {
    const st = S();
    if (module === 'overhaulAction') return (st.overhaul || {}).items || [];
    if (module === 'overhaulMaterial') return (st.overhaul || {}).materials || [];
    if (module === 'overhaulPerson') {
      if (ITO.normalizeOverhaulPersonnel && st.overhaul) ITO.normalizeOverhaulPersonnel(st.overhaul);
      return (st.overhaul || {}).personnel || [];
    }
    if (module === 'task') {
      if (scope === 'sub') {
        const subs = [];
        (st.tasks || []).forEach(function (task) { (task.subs || []).forEach(function (sub) { subs.push(sub); }); });
        return subs;
      }
      return st.tasks || [];
    }
    if (module === 'inspectionPlan') return st.inspectionPlans || [];
    if (module === 'inspectionRecord') return st.inspectionRecords || [];
    if (module === 'maintenancePlan') return st.maintenancePlans || [];
    if (module === 'maintenanceRecord') return st.maintenanceRecords || [];
    if (module === 'duty') return (st.duty && st.duty.weeks) || [];
    return [];
  }

  function fieldUsage(f) {
    return fieldRecords(f.module, fieldScope(f)).filter(function (r) {
      if (!r || !r.extra || !Object.prototype.hasOwnProperty.call(r.extra, f.key)) return false;
      const v = r.extra[f.key];
      if (Array.isArray(v) && !v.length) return false;
      return v !== '' && v != null;
    }).length;
  }

  function dictValues(id) {
    const dict = dictById(id);
    if (!dict) return [];
    return (dict.values || []).slice().sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
  }

  ITO.dictValues = function (id, onlyEnabled) {
    const list = dictValues(id);
    return (onlyEnabled === false ? list : list.filter(function (v) { return v.enabled !== false; })).map(function (v) { return v.name; });
  };

  ITO.dictOptions = function (id, selected, placeholder) {
    const values = ITO.dictValues(id, true);
    return '<option value="">' + U().esc(placeholder || '请选择') + '</option>' + values.map(function (v) {
      return '<option value="' + U().esc(v) + '"' + (v === selected ? ' selected' : '') + '>' + U().esc(v) + '</option>';
    }).join('');
  };

  ITO.fieldDefsFor = function (module, scope) {
    const want = scope || 'main';
    return fields().filter(function (f) {
      if (f.module !== module || f.enabled === false) return false;
      if (module !== 'task') return true;
      const s = fieldScope(f);
      return s === 'both' || s === want;
    }).slice().sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
  };

  function fieldOptions(f) {
    if (f.source === 'dict' && f.dictId) return ITO.dictValues(f.dictId, true);
    return String(f.options || '').split(/[\n,，、]/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function controlValue(root, key) {
    const el = root.querySelector('[data-cf="' + key + '"]');
    if (!el) return '';
    if (el.type === 'checkbox') return el.checked ? '是' : '否';
    return String(el.value == null ? '' : el.value);
  }

  function conditionMatches(value, want) {
    const text = String(value == null ? '' : value).trim();
    const expected = String(want == null ? '' : want).trim();
    if (!expected) return !!text && text !== '[]' && text !== '未选择';
    if (text === expected) return true;
    return text.split(/[、,，]/).map(function (s) { return s.trim(); }).indexOf(expected) > -1;
  }

  function isFieldVisible(root, f) {
    if (!f || !f.dependsOn) return true;
    return conditionMatches(controlValue(root, f.dependsOn), f.dependsValue);
  }

  function syncCustomFieldVisibility(root) {
    if (!root) return;
    root.querySelectorAll('[data-cf-field]').forEach(function (box) {
      const dep = box.dataset.cfDependsOn;
      if (!dep) return;
      const visible = conditionMatches(controlValue(root, dep), box.dataset.cfDependsValue || '');
      box.style.display = visible ? '' : 'none';
    });
  }

  ITO.syncCustomFieldVisibility = syncCustomFieldVisibility;

  function attachmentList(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'object') return [value];
    try {
      const parsed = JSON.parse(String(value));
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function selectedValues(value) {
    return String(value == null ? '' : value).split(/[、,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function fmtFieldValue(f, value) {
    if (value == null || value === '') return '—';
    if (f.type === 'switch') return value ? '是' : '否';
    if (f.type === 'amount') return Number(value).toLocaleString() + ' 元';
    if (f.type === 'attachment') {
      const files = attachmentList(value);
      if (!files.length) return '—';
      return '<span class="cf-attach-inline">' + files.map(function (a) {
        return '<button type="button" class="cf-attach-link" data-cf-download="' + U().esc(a.id) + '">' + U().esc(a.name) + '</button>';
      }).join('') + '</span>';
    }
    if (f.type === 'multiselect') {
      return selectedValues(value).map(function (v) { return '<span class="tag-inline">' + U().esc(v) + '</span>'; }).join('') || '—';
    }
    if (f.type === 'link') return '<a class="link-btn" href="' + U().esc(value) + '" target="_blank" rel="noopener">' + U().esc(value) + '</a>';
    return U().esc(String(value));
  }

  function canEditField(f, role) {
    if (S().role === 'super') return true;
    if (role === 'admin') return true;
    const roles = (f.editableRoles && f.editableRoles.length) ? f.editableRoles : ['employee', 'manager', 'leader', 'admin'];
    return roles.indexOf(S().role) > -1;
  }

  function control(f, record) {
    const value = record && record.extra ? record.extra[f.key] : (f.defaultValue || '');
    const canEdit = canEditField(f, S().role);
    const disabled = canEdit ? '' : ' disabled';
    const common = ' data-cf="' + U().esc(f.key) + '"' + disabled + (f.placeholder ? ' placeholder="' + U().esc(f.placeholder) + '"' : '');
    if (f.type === 'textarea') {
      return '<textarea' + common + ' rows="3">' + U().esc(value == null ? '' : value) + '</textarea>';
    }
    if (f.type === 'multiselect') {
      const opts = fieldOptions(f);
      const chosen = selectedValues(value);
      const tags = chosen.length ? chosen.map(function (o) {
        return '<span class="cf-multi-tag">' + U().esc(o) +
          (canEdit ? '<button type="button" data-cf-unpick="' + U().esc(o) + '" aria-label="移除 ' + U().esc(o) + '">×</button>' : '') +
        '</span>';
      }).join('') : '<span class="cf-multi-placeholder">未选择</span>';
      const options = opts.length ? opts.map(function (o) {
        return '<label class="cf-multi-option" data-cf-option-text="' + U().esc(o) + '"><input type="checkbox" data-cf-opt="' + U().esc(o) + '"' + (chosen.indexOf(o) > -1 ? ' checked' : '') + disabled + '><span>' + U().esc(o) + '</span></label>';
      }).join('') : '<span class="form-hint">暂无可选选项</span>';
      return '<div class="cf-multi" data-cf-multi="' + U().esc(f.key) + '">' +
        '<div class="cf-multi-tags" data-cf-multi-tags>' + tags + '</div>' +
        '<div class="cf-multi-tools">' +
          '<input type="search" data-cf-multi-search placeholder="搜索选项…" autocomplete="off"' + disabled + '>' +
          '<span class="cf-multi-count" data-cf-multi-count>已选 ' + chosen.length + ' 项</span>' +
          '<button type="button" class="link-btn" data-cf-multi-clear' + disabled + '>清空</button>' +
        '</div>' +
        '<div class="cf-multi-options">' + options + '</div>' +
        '<div class="cf-multi-empty form-hint" data-cf-multi-empty hidden>没有匹配的选项</div>' +
        '<input type="hidden" data-cf="' + U().esc(f.key) + '" value="' + U().esc(chosen.join('、')) + '"' + disabled + '>' +
      '</div>';
    }
    if (f.type === 'attachment') {
      const files = attachmentList(value);
      return '<div class="cf-attach" data-cf-attach="' + U().esc(f.key) + '">' +
        '<div class="cf-attach-list">' + (files.length ? files.map(function (a) {
          return '<span class="cf-attach-chip"><button type="button" data-cf-download="' + U().esc(a.id) + '">' + U().esc(a.name) + '</button><i>' + U().esc(window.DeliverableStore ? window.DeliverableStore.formatSize(a.size) : '') + '</i>' +
            (canEdit ? '<button type="button" class="cf-attach-remove" data-cf-remove="' + U().esc(a.id) + '" aria-label="移除附件">×</button>' : '') + '</span>';
        }).join('') : '<span class="form-hint">暂未添加附件</span>') + '</div>' +
        '<input type="hidden" data-cf="' + U().esc(f.key) + '" value="' + U().esc(JSON.stringify(files)) + '"' + disabled + '>' +
        (canEdit ? '<input type="file" multiple data-cf-file="' + U().esc(f.key) + '" hidden><button type="button" class="btn btn-soft btn-sm" data-cf-add="' + U().esc(f.key) + '">添加附件</button>' : '') +
      '</div>';
    }
    if (f.type === 'select') {
      const opts = fieldOptions(f);
      return '<select' + common + '><option value="">请选择</option>' + opts.map(function (o) {
        return '<option value="' + U().esc(o) + '"' + (o === value ? ' selected' : '') + '>' + U().esc(o) + '</option>';
      }).join('') + '</select>';
    }
    if (f.type === 'person') {
      return '<select' + common + '><option value="">请选择人员</option>' + (S().staff || []).map(function (p) {
        return '<option value="' + U().esc(p.name) + '"' + (p.name === value ? ' selected' : '') + '>' + U().esc(p.name) + '</option>';
      }).join('') + '</select>';
    }
    if (f.type === 'switch') {
      return '<label class="ticket-check-line"><input type="checkbox" data-cf="' + U().esc(f.key) + '"' + (value ? ' checked' : '') + disabled + '><span>是</span></label>';
    }
    if (f.type === 'date') return '<input type="date"' + common + ' value="' + U().esc(value) + '">';
    if (f.type === 'datetime') return '<input type="datetime-local"' + common + ' value="' + U().esc(value) + '">';
    if (f.type === 'number' || f.type === 'amount') {
      return '<input type="number" step="' + (f.type === 'amount' ? '0.01' : '1') + '"' + common + ' value="' + U().esc(value) + '">' +
        (f.unit ? '<span class="form-hint">单位：' + U().esc(f.unit) + '</span>' : '');
    }
    if (f.type === 'link') {
      return '<input type="url"' + common + ' value="' + U().esc(value) + '" placeholder="' + U().esc(f.placeholder || 'https://') + '">';
    }
    return '<input type="text"' + common + ' value="' + U().esc(value) + '">' + (f.unit ? '<span class="form-hint">单位：' + U().esc(f.unit) + '</span>' : '');
  }

  ITO.customFieldForm = function (module, record, scope) {
    const list = ITO.fieldDefsFor(module, scope);
    if (!list.length) return '';
    const groups = {};
    list.forEach(function (f) {
      const key = f.group || '扩展信息';
      (groups[key] = groups[key] || []).push(f);
    });
    return Object.keys(groups).map(function (groupName) {
      return '<div class="oh-form-section custom-field-section">' +
        '<div class="subtask-head"><div><h4>' + U().esc(groupName) + '</h4><span>自定义字段 · 由「字典配置 · 字段定义」生成</span></div></div>' +
        '<div class="form-grid cols-3">' + groups[groupName].map(function (f) {
          const span = f.width === 3 ? ' full' : (f.width === 2 ? ' span-2' : '');
          const condition = f.dependsOn
            ? ' data-cf-depends-on="' + U().esc(f.dependsOn) + '" data-cf-depends-value="' + U().esc(f.dependsValue || '') + '"'
            : '';
          return '<div class="form-field' + span + '" data-cf-field="' + U().esc(f.key) + '"' + condition + '>' +
            '<label>' + U().esc(f.label) + (f.required ? ' <em>*</em>' : '') +
            (f.dependsOn ? ' <small class="cf-conditional-hint">条件显示</small>' : '') + '</label>' + control(f, record) + '</div>';
        }).join('') + '</div></div>';
    }).join('');
  };

  ITO.readCustomFields = function (root, module, oldExtra, scope) {
    const out = Object.assign({}, oldExtra || {});
    const errors = [];
    ITO.fieldDefsFor(module, scope).forEach(function (f) {
      const el = root.querySelector('[data-cf="' + f.key + '"]');
      if (!el) { if (oldExtra && oldExtra[f.key] != null) out[f.key] = oldExtra[f.key]; return; }
      if (!isFieldVisible(root, f)) {
        if (oldExtra && oldExtra[f.key] != null) out[f.key] = oldExtra[f.key];
        return;
      }
      let value = f.type === 'switch' ? !!el.checked : el.value;
      if (typeof value === 'string') value = value.trim();
      if (f.type === 'attachment') {
        const kept = attachmentList(value);
        const previous = attachmentList(oldExtra && oldExtra[f.key]);
        const keepIds = {};
        kept.forEach(function (a) { keepIds[a.id] = true; });
        const removed = previous.filter(function (a) { return !keepIds[a.id]; }).map(function (a) { return a.id; });
        value = kept;
        if (removed.length && window.DeliverableStore && window.DeliverableStore.deleteFiles) {
          window.DeliverableStore.deleteFiles(removed).catch(function (err) {
            if (window.console && console.warn) console.warn('[custom-field] 附件存储清理失败:', err);
          });
        }
      }
      if (f.required && (value === '' || value == null || (Array.isArray(value) && !value.length))) {
        errors.push(f.label + '为必填项');
        el.classList.add('is-invalid');
        return;
      }
      if (value !== '' && (f.type === 'number' || f.type === 'amount')) {
        const num = Number(value);
        if (f.min !== '' && f.min != null && num < Number(f.min)) errors.push(f.label + '不能小于 ' + f.min);
        if (f.max !== '' && f.max != null && num > Number(f.max)) errors.push(f.label + '不能大于 ' + f.max);
      }
      if (value !== '' && f.pattern) {
        try { if (!new RegExp(f.pattern).test(String(value))) errors.push(f.label + '格式不正确'); } catch (e) { /* noop */ }
      }
      out[f.key] = value;
    });
    if (!errors.length && root && root.__cfAddedFiles && window.DeliverableStore) {
      const keepIds = {};
      ITO.fieldDefsFor(module, scope).forEach(function (f) {
        if (f.type !== 'attachment') return;
        attachmentList(out[f.key]).forEach(function (a) { keepIds[a.id] = true; });
      });
      const orphan = Object.keys(root.__cfAddedFiles).filter(function (id) { return !keepIds[id]; });
      if (orphan.length && window.DeliverableStore.deleteFiles) {
        window.DeliverableStore.deleteFiles(orphan).catch(function () { /* noop */ });
      }
      root.__cfCommitted = true;
      root.__cfAddedFiles = {};
    }
    return { values: out, errors: errors };
  };

  ITO.cleanupCustomFieldUploads = function (root) {
    if (!root || root.__cfCommitted || !root.__cfAddedFiles) return;
    const ids = Object.keys(root.__cfAddedFiles);
    if (ids.length && window.DeliverableStore && window.DeliverableStore.deleteFiles) {
      window.DeliverableStore.deleteFiles(ids).catch(function () { /* noop */ });
    }
    root.__cfAddedFiles = {};
  };

  ITO.mountCustomFields = function (root) {
    if (!root) return;
    root.__cfAddedFiles = root.__cfAddedFiles || {};
    root.querySelectorAll('.cf-multi').forEach(function (box) {
      if (box.dataset.mounted === '1' || box.closest('.cf-live-preview')) return;
      box.dataset.mounted = '1';
      const hidden = box.querySelector('[data-cf]');
      const opts = Array.prototype.slice.call(box.querySelectorAll('[data-cf-opt]'));
      const tags = box.querySelector('[data-cf-multi-tags]');
      const count = box.querySelector('[data-cf-multi-count]');
      const clear = box.querySelector('[data-cf-multi-clear]');
      const search = box.querySelector('[data-cf-multi-search]');
      const empty = box.querySelector('[data-cf-multi-empty]');
      const labels = Array.prototype.slice.call(box.querySelectorAll('[data-cf-option-text]'));
      const canEdit = !hidden.disabled;
      const sync = function () {
        const picked = opts.filter(function (cb) { return cb.checked; }).map(function (cb) { return cb.dataset.cfOpt; });
        hidden.value = picked.join('、');
        if (count) count.textContent = '已选 ' + picked.length + ' 项';
        if (clear) clear.disabled = !canEdit || !picked.length;
        if (tags) {
          tags.innerHTML = picked.length ? picked.map(function (o) {
            return '<span class="cf-multi-tag">' + U().esc(o) +
              (canEdit ? '<button type="button" data-cf-unpick="' + U().esc(o) + '" aria-label="移除 ' + U().esc(o) + '">×</button>' : '') +
            '</span>';
          }).join('') : '<span class="cf-multi-placeholder">未选择</span>';
        }
      };
      const filter = function () {
        const keyword = String(search.value || '').trim().toLowerCase();
        let visible = 0;
        labels.forEach(function (label) {
          const match = !keyword || String(label.dataset.cfOptionText || '').toLowerCase().indexOf(keyword) > -1;
          label.style.display = match ? '' : 'none';
          if (match) visible += 1;
        });
        if (empty) empty.hidden = visible > 0 || !labels.length;
      };
      opts.forEach(function (cb) { cb.addEventListener('change', sync); });
      if (search) search.addEventListener('input', filter);
      box.addEventListener('click', function (e) {
        const unpick = e.target.closest('[data-cf-unpick]');
        if (unpick && canEdit) {
          const target = opts.find(function (cb) { return cb.dataset.cfOpt === unpick.dataset.cfUnpick; });
          if (target) { target.checked = false; sync(); }
          return;
        }
        const clearBtn = e.target.closest('[data-cf-multi-clear]');
        if (clearBtn && canEdit) {
          opts.forEach(function (cb) { cb.checked = false; });
          sync();
        }
      });
      sync();
    });
    root.querySelectorAll('[data-cf-attach]').forEach(function (box) {
      if (box.dataset.mounted === '1') return;
      box.dataset.mounted = '1';
      const key = box.dataset.cfAttach;
      const hidden = box.querySelector('[data-cf="' + key + '"]');
      const list = box.querySelector('.cf-attach-list');
      const input = box.querySelector('[data-cf-file]');
      const add = box.querySelector('[data-cf-add]');
      let files = attachmentList(hidden.value);
      const paint = function () {
        list.innerHTML = files.length ? files.map(function (a) {
          return '<span class="cf-attach-chip"><button type="button" data-cf-download="' + U().esc(a.id) + '">' + U().esc(a.name) + '</button><i>' + U().esc(window.DeliverableStore ? window.DeliverableStore.formatSize(a.size) : '') + '</i><button type="button" class="cf-attach-remove" data-cf-remove="' + U().esc(a.id) + '" aria-label="移除附件">×</button></span>';
        }).join('') : '<span class="form-hint">暂未添加附件</span>';
        hidden.value = JSON.stringify(files);
      };
      if (add && input) {
        add.addEventListener('click', function () { input.click(); });
        input.addEventListener('change', function () {
          const picked = Array.prototype.slice.call(input.files || []);
          if (!picked.length) return;
          if (!window.DeliverableStore) { U().toast('附件存储未初始化', 'warn'); return; }
          Promise.resolve(window.DeliverableStore.saveFiles(picked, S().user.name)).then(function (metas) {
            metas.forEach(function (meta) { root.__cfAddedFiles[meta.id] = true; });
            files = files.concat(metas);
            input.value = '';
            paint();
            U().toast('附件已添加');
          }).catch(function (err) {
            U().toast(err.message || '附件上传失败', 'warn');
          });
        });
      }
      box.addEventListener('click', function (e) {
        const remove = e.target.closest('[data-cf-remove]');
        if (!remove) return;
        files = files.filter(function (a) { return a.id !== remove.dataset.cfRemove; });
        paint();
      });
      paint();
    });
    if (!root.__cfConditionBound) {
      root.__cfConditionBound = true;
      const sync = function () { syncCustomFieldVisibility(root); };
      root.addEventListener('change', sync);
      root.addEventListener('input', sync);
    }
    syncCustomFieldVisibility(root);
  };

  if (!window.__itoCustomDownloadBound) {
    window.__itoCustomDownloadBound = true;
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-cf-download]');
      if (!btn || !window.DeliverableStore) return;
      e.preventDefault();
      window.DeliverableStore.download(btn.dataset.cfDownload);
    });
  }

  ITO.customFieldRows = function (module, record, scope) {
    const list = ITO.fieldDefsFor(module, scope).filter(function (f) {
      if (!f.dependsOn) return true;
      return conditionMatches(record && record.extra ? record.extra[f.dependsOn] : '', f.dependsValue);
    });
    if (!list.length) return '';
    return list.map(function (f) {
      const v = record && record.extra ? record.extra[f.key] : '';
      return '<tr><td>' + U().esc(f.label) + '</td><td>' + fmtFieldValue(f, v) + '</td></tr>';
    }).join('');
  };

  ITO.customFieldCells = function (module, record, scope) {
    return ITO.fieldDefsFor(module, scope).filter(function (f) { return f.list; }).map(function (f) {
      const visible = !f.dependsOn || conditionMatches(record && record.extra ? record.extra[f.dependsOn] : '', f.dependsValue);
      return '<td>' + (visible ? fmtFieldValue(f, record && record.extra ? record.extra[f.key] : '') : '—') + '</td>';
    }).join('');
  };

  ITO.customFieldHeaders = function (module, scope) {
    return ITO.fieldDefsFor(module, scope).filter(function (f) { return f.list; }).map(function (f) { return f.label; });
  };

  ITO.customFieldExport = function (module, record, scope) {
    return ITO.fieldDefsFor(module, scope).filter(function (f) { return f.export; }).map(function (f) {
      const v = record && record.extra ? record.extra[f.key] : '';
      if (f.dependsOn && !conditionMatches(record && record.extra ? record.extra[f.dependsOn] : '', f.dependsValue)) return '';
      if (v == null || v === '') return '';
      if (f.type === 'switch') return v ? '是' : '否';
      if (f.type === 'attachment') return attachmentList(v).map(function (a) { return a.name; }).join(' / ');
      if (f.type === 'multiselect') return selectedValues(v).join('、');
      return String(v);
    });
  };

  ITO.customFieldExportHeaders = function (module, scope) {
    return ITO.fieldDefsFor(module, scope).filter(function (f) { return f.export; }).map(function (f) { return f.label; });
  };

  ITO.customFieldFilters = function (module, scope) {
    return ITO.fieldDefsFor(module, scope).filter(function (f) { return f.filter; });
  };

  ITO.customFieldMatch = function (module, record, filterState, scope) {
    const list = ITO.customFieldFilters(module, scope);
    for (let i = 0; i < list.length; i += 1) {
      const f = list[i];
      let wants = filterState && filterState[f.key];
      if (wants == null || wants === '') continue;
      if (!Array.isArray(wants)) wants = [wants];
      wants = wants.reduce(function (list, x) {
        return list.concat(String(x).split(/[、,，]/).map(function (s) { return s.trim(); }).filter(Boolean));
      }, []);
      if (!wants.length) continue;
      const raw = record && record.extra ? record.extra[f.key] : '';
      const v = f.type === 'switch' ? (raw ? '是' : '否') : raw;
      const optionFilter = f.type === 'select' || f.type === 'switch' || f.source === 'dict' || f.source === 'options';
      const text = String(v == null ? '' : v);
      let hit = false;
      if (f.type === 'multiselect') {
        const selected = selectedValues(v);
        hit = wants.some(function (want) { return selected.indexOf(want) > -1; });
      } else if (optionFilter) {
        hit = wants.some(function (want) { return text === want; });
      } else {
        hit = wants.some(function (want) { return text.toLowerCase().indexOf(want.toLowerCase()) > -1; });
      }
      if (!hit) return false;
    }
    return true;
  };

  function downloadJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function normalizeImportedField(raw) {
    const allowedTypes = FIELD_TYPES.map(function (t) { return t[0]; });
    const modules = FIELD_MODULES.map(function (m) { return m.key; });
    if (!raw || modules.indexOf(raw.module) === -1) return null;
    if (!raw.label || !raw.key || !/^[A-Za-z][A-Za-z0-9_]*$/.test(raw.key)) return null;
    if (allowedTypes.indexOf(raw.type) === -1) return null;
    return {
      id: 'CF-IMP-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      module: raw.module,
      label: String(raw.label).slice(0, 24),
      key: raw.key,
      type: raw.type,
      scope: raw.scope === 'sub' || raw.scope === 'both' ? raw.scope : 'main',
      dependsOn: raw.dependsOn || '',
      dependsValue: raw.dependsValue || '',
      source: raw.source || 'none',
      dictId: raw.dictId || '',
      options: raw.options || '',
      defaultValue: raw.defaultValue || '',
      required: !!raw.required,
      unit: raw.unit || '',
      placeholder: raw.placeholder || '',
      min: raw.min == null ? '' : raw.min,
      max: raw.max == null ? '' : raw.max,
      pattern: raw.pattern || '',
      group: raw.group || '扩展信息',
      sort: Number(raw.sort) || 0,
      width: Number(raw.width) || 1,
      list: !!raw.list,
      filter: !!raw.filter,
      export: !!raw.export,
      editableRoles: Array.isArray(raw.editableRoles) && raw.editableRoles.length ? raw.editableRoles : ['employee', 'manager', 'leader', 'admin'],
      enabled: raw.enabled !== false,
      createdAt: raw.createdAt || D.meta.demoNow,
      updatedAt: D.meta.demoNow
    };
  }

  function importFieldList(list, activeModule) {
    const incoming = list.map(normalizeImportedField).filter(Boolean);
    if (!incoming.length) { U().toast('没有可导入的有效字段定义', 'warn'); return; }
    const conflicts = incoming.filter(function (x) {
      return fields().some(function (f) { return f.module === x.module && f.key === x.key; });
    });
    const apply = function () {
      incoming.forEach(function (x) {
        const existing = fields().find(function (f) { return f.module === x.module && f.key === x.key; });
        if (existing) Object.assign(existing, x, { id: existing.id });
        else fields().push(x);
      });
      ITO.log('导入字段定义', incoming.length + ' 个字段', '配置');
      U().toast('已导入 ' + incoming.length + ' 个字段定义');
      S().ui.fieldModule = activeModule;
      ITO.refresh();
    };
    if (conflicts.length) {
      U().confirm({
        title: '覆盖同名字段？',
        text: '有 ' + conflicts.length + ' 个字段与现有字段模块和编码相同，继续会覆盖现有定义。',
        okText: '覆盖导入'
      }).then(function (ok) { if (ok) apply(); });
    } else {
      apply();
    }
  }

  /* ── dictionary page ─────────────────────── */
  P.dictionary = {
    render: function () {
      const st = S();
      st.ui = st.ui || {};
      const tab = st.ui.dictTab || 'items';
      const activeId = st.ui.dictActive || (dicts()[0] || {}).id || '';
      const active = dictById(activeId) || dicts()[0];
      const q = String(st.ui.dictSearch || '').trim().toLowerCase();

      const tabs = '<div class="tabs dictionary-tabs">' +
        '<button type="button" class="tab' + (tab === 'items' ? ' active' : '') + '" data-dict-tab="items">字典项</button>' +
        '<button type="button" class="tab' + (tab === 'fields' ? ' active' : '') + '" data-dict-tab="fields">字段定义</button>' +
      '</div>';

      const groups = {};
      dicts().forEach(function (d) {
        (groups[d.group] = groups[d.group] || []).push(d);
      });
      const nav = '<aside class="card dict-nav-card">' + Object.keys(groups).map(function (group) {
        return '<div class="dict-nav-group"><span class="dict-nav-title">' + U().esc(group) + '</span>' +
          groups[group].map(function (d) {
            const count = (d.values || []).length;
            return '<button type="button" class="dict-nav-item' + (d.id === (active && active.id) ? ' active' : '') + '" data-dict-id="' + U().esc(d.id) + '">' +
              '<span>' + U().esc(d.name) + '</span>' +
              (d.readOnly ? '<small title="配置位置：' + U().esc(readOnlyInfo(d).hint) + '">只读</small>' : '<small>' + count + '</small>') +
            '</button>';
          }).join('') + '</div>';
      }).join('') + '</aside>';

      if (tab === 'fields') return this.renderFields(tabs);

      if (!active) {
        return U().pageHead({ title: '字典配置', sub: '维护系统字段的可选值', actions: '<span class="head-tag">' + U().esc(dictionaryRoleTag()) + '</span>' }) + tabs +
          '<div class="card"><p class="muted">暂无字典</p></div>';
      }

      const values = (active.values || []).slice().sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); })
        .filter(function (v) { return !q || (v.name + ' ' + v.code).toLowerCase().indexOf(q) > -1; });
      const enabled = (active.values || []).filter(function (v) { return v.enabled !== false; }).length;
      const canEdit = !active.readOnly;
      const ro = readOnlyInfo(active);

      const panel = '<section class="card dict-panel">' +
        '<div class="dict-panel-head">' +
          '<div><div class="dict-title-line"><h3>' + U().esc(active.name) + '</h3>' +
            '<span class="dict-mode ' + (canEdit ? 'editable' : 'readonly') + '">' + (canEdit ? '可编辑' : '系统只读') + '</span></div>' +
            '<p>' + U().esc(active.desc || '') + '</p></div>' +
          '<div class="dict-panel-actions">' +
            '<input class="oh-search" id="dictValueSearch" type="search" placeholder="搜索名称 / 编码…" value="' + U().esc(st.ui.dictSearch || '') + '">' +
            (canEdit ? '<button class="btn btn-primary btn-sm" id="dictAddValue" type="button">' + U().icon('plus') + '新增' + U().esc(active.name.replace('大修', '').replace('任务', '')) + '</button>' : '') +
          '</div>' +
        '</div>' +
        '<div class="dict-note">' + (canEdit
          ? U().icon('alert') + ' 使用中的字典项不能删除。如不再使用，请先停用；历史数据会保留原名称，新增和编辑下拉不再出现。'
          : U().icon('alert') + ' <span>系统只读。配置位置：' + U().esc(ro.hint) +
            (ro.route && ro.accessible ? ' · <a class="dict-source-link" href="#/' + U().esc(ro.route) + '">前往' + U().esc(ro.routeName || '配置页') + ' →</a>' :
              (ro.route ? '（当前角色无该模块入口）' : '')) + '</span>') + '</div>' +
        '<div class="table-wrap"><table class="data-table dict-table"><thead><tr><th>名称</th><th>编码</th><th>状态</th><th title="按当前业务记录实时统计，0 条表示暂无记录使用">使用中</th><th class="num">排序</th><th style="text-align:right">操作</th></tr></thead><tbody>' +
          (values.length ? values.map(function (v) {
            const used = usageCount(active, v.name);
            return '<tr data-dict-value="' + U().esc(v.code) + '">' +
              '<td><b>' + U().esc(v.name) + '</b></td>' +
              '<td><span class="mono">' + U().esc(v.code) + '</span></td>' +
              '<td>' + (v.enabled === false ? U().badge('停用', 'red') : U().badge('启用', 'green')) + '</td>' +
              '<td class="num">' + used + ' 条</td>' +
              '<td class="num">' + (v.sort || 0) + '</td>' +
              '<td style="text-align:right"><div class="row-actions">' + (canEdit
                ? '<button class="btn btn-ghost btn-sm" data-dict-edit="' + U().esc(v.code) + '" type="button">编辑</button>' +
                  '<button class="btn btn-ghost btn-sm" data-dict-toggle="' + U().esc(v.code) + '" type="button">' + (v.enabled === false ? '启用' : '停用') + '</button>'
                : '<span class="muted">只读</span>') + '</div></td>' +
            '</tr>';
          }).join('') : '<tr><td colspan="6">' + U().emptyState('没有匹配的字典项', '调整搜索条件或新增字典项', 'clipboard') + '</td></tr>') +
        '</tbody></table></div>' +
        '<div class="dict-panel-foot"><span>共 ' + (active.values || []).length + ' 个 · 启用 ' + enabled + ' 个</span><span>编码保存后不可修改，用于历史数据关联</span></div>' +
      '</section>';

      return U().pageHead({
        title: '字典配置',
        sub: '维护字典项与字段定义 · 大修基地 / 分类等新增后立即进入表单与筛选',
        actions: '<span class="head-tag">' + U().esc(dictionaryRoleTag()) + '</span>'
      }) + tabs + '<div class="dict-layout">' + nav + panel + '</div>';
    },

    renderFields: function (tabs) {
      const st = S();
      st.ui = st.ui || {};
      const activeModule = st.ui.fieldModule || 'overhaulAction';
      const module = FIELD_MODULES.find(function (m) { return m.key === activeModule; }) || FIELD_MODULES[0];
      const list = fields().filter(function (f) { return f.module === activeModule; })
        .slice().sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
      const nav = '<aside class="card dict-nav-card"><div class="dict-nav-group">' +
        FIELD_MODULES.map(function (m) {
          const count = fields().filter(function (f) { return f.module === m.key; }).length;
          return '<button type="button" class="dict-nav-item' + (m.key === activeModule ? ' active' : '') +
            (m.ready ? '' : ' is-disabled') + '"' + (m.ready ? ' data-field-module="' + m.key + '"' : ' disabled') + '>' +
            '<span>' + U().esc(m.name) + '</span><small>' + (m.ready ? count : '待开放') + '</small></button>';
        }).join('') + '</div></aside>';

      const panel = '<section class="card dict-panel">' +
        '<div class="dict-panel-head"><div><h3>字段定义 · ' + U().esc(module.name) + '</h3>' +
          '<p>为原本不存在的字段建立定义；保存后自动出现在' + U().esc(module.name) + '的新增 / 编辑表单与详情中。</p></div>' +
          '<div class="dict-panel-actions">' +
            '<button class="btn btn-ghost btn-sm" id="dictExportFields" type="button">' + U().icon('download') + '导出当前模块</button>' +
            '<button class="btn btn-ghost btn-sm" id="dictExportAllFields" type="button">导出全部字段</button>' +
            '<button class="btn btn-ghost btn-sm" id="dictImportFields" type="button">导入字段</button>' +
            '<input type="file" id="dictFieldFile" accept=".json,application/json" hidden>' +
            '<button class="btn btn-primary btn-sm" id="dictAddField" type="button">' + U().icon('plus') + '新增字段</button></div></div>' +
        '<div class="dict-note">' + U().icon('alert') + ' 系统内置字段只读，不可删除或改类型；字段编码保存后不可修改。停用字段后历史数据仍保留，只是不再出现在表单与新增数据中，自定义字段值存放在记录的 extra 对象。</div>' +
        '<div class="table-wrap"><table class="data-table dict-table"><thead><tr><th>字段名称</th><th>字段编码</th><th>类型</th><th title="对应模块记录中该字段已填写的条数">使用中</th><th>数据来源</th><th>必填</th><th>列表</th><th>筛选</th><th>可编辑角色</th><th>状态</th><th style="text-align:right">操作</th></tr></thead><tbody>' +
          (list.length ? list.map(function (f) {
            const typeName = (FIELD_TYPES.find(function (t) { return t[0] === f.type; }) || [])[1] || f.type;
            const source = f.source === 'dict' ? ('字典 · ' + ((dictById(f.dictId) || {}).name || '—')) : (f.source === 'options' ? '自定义选项' : '无');
            const roles = (f.editableRoles || []).map(function (r) {
              return (ROLE_OPTIONS.find(function (o) { return o[0] === r; }) || [])[1] || r;
            }).join(' / ') || '全部';
            const scopeText = f.module === 'task' && (f.scope === 'sub' || f.scope === 'both')
              ? (f.scope === 'sub' ? '执行任务' : '主任务 + 执行任务') : '';
            const conditionText = f.dependsOn
              ? '条件：' + f.dependsOn + (f.dependsValue ? ' = ' + f.dependsValue : ' 已填写')
              : '';
            return '<tr><td><b>' + U().esc(f.label) + '</b>' +
                (scopeText ? '<small class="cf-field-meta">' + U().esc(scopeText) + '</small>' : '') +
                (conditionText ? '<small class="cf-field-meta">' + U().esc(conditionText) + '</small>' : '') +
              '</td><td><span class="mono">' + U().esc(f.key) + '</span></td>' +
              '<td>' + U().esc(typeName) + '</td><td class="num">' + fieldUsage(f) + ' 条</td><td>' + U().esc(source) + '</td>' +
              '<td>' + (f.required ? '是' : '—') + '</td><td>' + (f.list ? '是' : '—') + '</td><td>' + (f.filter ? '是' : '—') + '</td>' +
              '<td><small class="muted">' + U().esc(roles) + '</small></td>' +
              '<td>' + (f.enabled === false ? U().badge('停用', 'red') : U().badge('启用', 'green')) + '</td>' +
              '<td style="text-align:right"><div class="row-actions">' +
                '<button class="btn btn-ghost btn-sm" data-field-edit="' + U().esc(f.id) + '" type="button">编辑</button>' +
                '<button class="btn btn-ghost btn-sm" data-field-toggle="' + U().esc(f.id) + '" type="button">' + (f.enabled === false ? '启用' : '停用') + '</button>' +
              '</div></td></tr>';
          }).join('') : '<tr><td colspan="11">' + U().emptyState('暂无自定义字段', '点击「新增字段」为' + module.name + '增加原本没有的字段', 'clipboard') + '</td></tr>') +
        '</tbody></table></div>' +
        '<div class="dict-panel-foot"><span>共 ' + list.length + ' 个字段 · 启用 ' + list.filter(function (f) { return f.enabled !== false; }).length + ' 个</span><span>表单、详情、列表与导出按字段配置自动生效</span></div>' +
      '</section>';

      return U().pageHead({
        title: '字典配置',
        sub: '字段定义 · 全部模块已开放',
        actions: '<span class="head-tag">' + U().esc(dictionaryRoleTag()) + '</span>'
      }) + tabs + '<div class="dict-layout">' + nav + panel + '</div>';
    },

    after: function () {
      const st = S();
      st.ui = st.ui || {};

      U().$$('[data-dict-tab]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          st.ui.dictTab = btn.dataset.dictTab;
          ITO.refresh();
        });
      });

      U().$$('[data-dict-id]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          st.ui.dictActive = btn.dataset.dictId;
          st.ui.dictSearch = '';
          ITO.refresh();
        });
      });

      U().$$('[data-field-module]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          st.ui.fieldModule = btn.dataset.fieldModule;
          ITO.refresh();
        });
      });

      const search = document.getElementById('dictValueSearch');
      if (search) search.addEventListener('input', function () {
        st.ui.dictSearch = search.value;
        ITO.refresh();
        const next = document.getElementById('dictValueSearch');
        if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
      });

      const active = dictById(st.ui.dictActive || (dicts()[0] || {}).id);
      if (active && !active.readOnly) {
        const add = document.getElementById('dictAddValue');
        if (add) add.addEventListener('click', function () { openValueForm(active, null); });
        U().$$('[data-dict-edit]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            const value = (active.values || []).find(function (v) { return v.code === btn.dataset.dictEdit; });
            if (value) openValueForm(active, value);
          });
        });
        U().$$('[data-dict-toggle]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            const value = (active.values || []).find(function (v) { return v.code === btn.dataset.dictToggle; });
            if (!value) return;
            value.enabled = value.enabled === false;
            ITO.log(value.enabled === false ? '停用字典项' : '启用字典项', active.name + ' · ' + value.name, '配置');
            U().toast(value.enabled === false ? '已停用，历史数据保留' : '已启用');
            ITO.refresh();
          });
        });
      }

      const addField = document.getElementById('dictAddField');
      if (addField) addField.addEventListener('click', function () {
        openFieldForm(st.ui.fieldModule || 'overhaulAction', null);
      });
      const activeFieldModule = st.ui.fieldModule || 'overhaulAction';
      const exportFields = document.getElementById('dictExportFields');
      if (exportFields) exportFields.addEventListener('click', function () {
        const list = fields().filter(function (f) { return f.module === activeFieldModule; });
        downloadJson('ITO字段定义-' + activeFieldModule + '.json', list);
        ITO.log('导出字段定义', activeFieldModule + ' · ' + list.length + ' 个字段', '配置');
        U().toast('字段定义 JSON 已导出');
      });
      const exportAllFields = document.getElementById('dictExportAllFields');
      if (exportAllFields) exportAllFields.addEventListener('click', function () {
        const list = fields().slice().sort(function (a, b) {
          return String(a.module).localeCompare(String(b.module)) || (a.sort || 0) - (b.sort || 0);
        });
        downloadJson('ITO字段定义-全部模块.json', list);
        ITO.log('导出全部字段定义', '9 个模块 · ' + list.length + ' 个字段', '配置');
        U().toast('全部字段定义 JSON 已导出');
      });
      const importFields = document.getElementById('dictImportFields');
      const fieldFile = document.getElementById('dictFieldFile');
      if (importFields && fieldFile) {
        importFields.addEventListener('click', function () { fieldFile.click(); });
        fieldFile.addEventListener('change', function () {
          const file = fieldFile.files && fieldFile.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = function () {
            try {
              const parsed = JSON.parse(String(reader.result || '[]'));
              const list = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.fields) ? parsed.fields : []);
              importFieldList(list, activeFieldModule);
            } catch (e) {
              U().toast('JSON 解析失败，请检查文件格式', 'warn');
            }
            fieldFile.value = '';
          };
          reader.readAsText(file);
        });
      }
      U().$$('[data-field-edit]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const f = fields().find(function (x) { return x.id === btn.dataset.fieldEdit; });
          if (f) openFieldForm(f.module, f);
        });
      });
      U().$$('[data-field-toggle]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const f = fields().find(function (x) { return x.id === btn.dataset.fieldToggle; });
          if (!f) return;
          f.enabled = f.enabled === false;
          f.updatedAt = D.meta.demoNow;
          ITO.log(f.enabled === false ? '停用自定义字段' : '启用自定义字段', f.label + '（' + f.key + '）', '配置');
          U().toast(f.enabled === false ? '字段已停用，历史数据保留' : '字段已启用');
          ITO.refresh();
        });
      });
    }
  };

  function openValueForm(dict, value) {
    const editing = !!value;
    U().modal({
      title: editing ? '编辑' + dict.name.replace('大修', '') : '新增' + dict.name.replace('大修', '').replace('任务', ''),
      sub: '新增后立即进入对应表单与筛选。',
      body: '<div class="form-grid">' +
        U().formRow({ label: '名称', required: true, control: '<input id="dvName" type="text" maxlength="24" value="' + U().esc(value ? value.name : '') + '" placeholder="例如：C地区">' }) +
        U().formRow({ label: '编码', required: true, control: '<input id="dvCode" type="text" maxlength="16" value="' + U().esc(value ? value.code : '') + '" placeholder="例如：C"' + (editing ? ' readonly' : '') + '>' }) +
        U().formRow({ label: '排序', control: '<input id="dvSort" type="number" min="0" step="1" value="' + (value ? value.sort : ((dict.values || []).length + 1)) + '">' }) +
        U().formRow({ label: '状态', control: '<label class="ticket-check-line"><input id="dvEnabled" type="checkbox"' + (!value || value.enabled !== false ? ' checked' : '') + '><span>启用</span></label>' }) +
      '</div>' + (editing ? '<p class="form-hint" style="margin-top:10px">编码保存后不可修改，用于历史数据关联。</p>' : ''),
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button><button class="btn btn-primary" data-save type="button">保存</button>',
      onMount: function (close, root) {
        U().bindFieldClear(root);
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-save]').addEventListener('click', function () {
          const nameEl = root.querySelector('#dvName');
          const codeEl = root.querySelector('#dvCode');
          const name = nameEl.value.trim();
          const code = codeEl.value.trim();
          if (!name) { U().showFieldError(nameEl, '请输入名称'); return; }
          if (!code) { U().showFieldError(codeEl, '请输入编码'); return; }
          const dup = (dict.values || []).some(function (v) { return v.code === code && (!editing || v !== value); });
          if (dup) { U().showFieldError(codeEl, '编码已存在'); return; }
          const dupName = (dict.values || []).some(function (v) { return v.name === name && (!editing || v !== value); });
          if (dupName) { U().showFieldError(nameEl, '名称已存在'); return; }
          const data = {
            name: name, code: code,
            sort: Number(root.querySelector('#dvSort').value) || 0,
            enabled: root.querySelector('#dvEnabled').checked
          };
          if (editing) Object.assign(value, data);
          else (dict.values || (dict.values = [])).push(data);
          ITO.log(editing ? '编辑字典项' : '新增字典项', dict.name + ' · ' + name, '配置');
          U().toast(editing ? '字典项已保存' : '字典项已新增，表单与筛选已同步');
          close();
          ITO.refresh();
        });
      }
    });
  }

  function fieldFormBody(module, f) {
    f = f || {};
    const typeOptions = FIELD_TYPES.map(function (t) {
      return '<option value="' + t[0] + '"' + (f.type === t[0] ? ' selected' : '') + '>' + t[1] + '</option>';
    }).join('');
    const dictOptions = '<option value="">请选择字典</option>' + dicts().filter(function (d) { return !d.readOnly; }).map(function (d) {
      return '<option value="' + U().esc(d.id) + '"' + (f.dictId === d.id ? ' selected' : '') + '>' + U().esc(d.name) + '</option>';
    }).join('');
    const siblings = fields().filter(function (x) {
      return x.module === module && x.key && (!f.key || x.key !== f.key);
    });
    const dependsOptions = '<option value="">始终显示</option>' + siblings.map(function (x) {
      return '<option value="' + U().esc(x.key) + '"' + (f.dependsOn === x.key ? ' selected' : '') + '>' + U().esc(x.label) + '（' + U().esc(x.key) + '）</option>';
    }).join('');
    const roleChecks = ROLE_OPTIONS.map(function (r) {
      const checked = !f.editableRoles || f.editableRoles.indexOf(r[0]) > -1;
      return '<label class="ticket-check-line" style="margin-right:14px"><input type="checkbox" data-role="' + r[0] + '"' + (checked ? ' checked' : '') + '><span>' + r[1] + '</span></label>';
    }).join('');
    return '<div class="form-grid cols-3">' +
      U().formRow({ label: '所属模块', required: true, control: '<select id="cfModule"' + (f.id ? ' disabled' : '') + '>' + FIELD_MODULES.filter(function (m) { return m.ready; }).map(function (m) {
        return '<option value="' + m.key + '"' + (module === m.key ? ' selected' : '') + '>' + m.name + '</option>';
      }).join('') + '</select>' }) +
      U().formRow({ label: '字段名称', required: true, control: '<input id="cfLabel" type="text" maxlength="24" value="' + U().esc(f.label || '') + '" placeholder="例如：设备位号">' }) +
      U().formRow({ label: '字段编码', required: true, control: '<input id="cfKey" type="text" maxlength="32" value="' + U().esc(f.key || '') + '" placeholder="例如：deviceNo"' + (f.id ? ' readonly' : '') + '>' }) +
      U().formRow({ label: '字段类型', required: true, control: '<select id="cfType">' + typeOptions + '</select>' }) +
      U().formRow({ label: '作用层级', control: '<select id="cfScope"><option value="main"' + ((f.scope || 'main') === 'main' ? ' selected' : '') + '>主任务 / 主体记录</option><option value="sub"' + (f.scope === 'sub' ? ' selected' : '') + '>执行任务</option><option value="both"' + (f.scope === 'both' ? ' selected' : '') + '>主任务 + 执行任务</option></select><span class="form-hint">仅任务模块区分主任务与执行任务</span>' }) +
      U().formRow({ label: '数据来源', control: '<select id="cfSource"><option value="none"' + (!f.source || f.source === 'none' ? ' selected' : '') + '>无</option><option value="dict"' + (f.source === 'dict' ? ' selected' : '') + '>引用字典</option><option value="options"' + (f.source === 'options' ? ' selected' : '') + '>自定义选项</option></select>' }) +
      U().formRow({ label: '显示条件', control: '<select id="cfDependsOn">' + dependsOptions + '</select>' }) +
      U().formRow({ label: '依赖值', control: '<input id="cfDependsValue" type="text" value="' + U().esc(f.dependsValue || '') + '" placeholder="如：紧急变更"><span class="form-hint">留空表示依赖字段已填写</span>' }) +
      U().formRow({ label: '字典分类', control: '<select id="cfDict">' + dictOptions + '</select>' }) +
      '<div class="form-field full" id="cfOptionsWrap"><label>自定义选项</label><textarea id="cfOptions" rows="3" placeholder="每行一个选项，例如：\n位号 A\n位号 B">' + U().esc(f.options || '') + '</textarea></div>' +
      U().formRow({ label: '默认值', control: '<input id="cfDefault" type="text" value="' + U().esc(f.defaultValue || '') + '">' }) +
      U().formRow({ label: '单位', control: '<input id="cfUnit" type="text" maxlength="12" value="' + U().esc(f.unit || '') + '" placeholder="如：个 / 元 / 天">' }) +
      U().formRow({ label: '占位提示', control: '<input id="cfPlaceholder" type="text" maxlength="40" value="' + U().esc(f.placeholder || '') + '">' }) +
      U().formRow({ label: '最小值', control: '<input id="cfMin" type="number" value="' + U().esc(f.min == null ? '' : f.min) + '">' }) +
      U().formRow({ label: '最大值', control: '<input id="cfMax" type="number" value="' + U().esc(f.max == null ? '' : f.max) + '">' }) +
      U().formRow({ label: '校验正则', control: '<input id="cfPattern" type="text" value="' + U().esc(f.pattern || '') + '" placeholder="选填，如 ^[A-Z]{2}\\d{3}$">' }) +
      U().formRow({ label: '展示分组', control: '<select id="cfGroup">' + FIELD_GROUPS.map(function (g) {
        return '<option value="' + g + '"' + ((f.group || '扩展信息') === g ? ' selected' : '') + '>' + g + '</option>';
      }).join('') + '</select>' }) +
      U().formRow({ label: '排序', control: '<input id="cfSort" type="number" min="0" step="1" value="' + (f.sort || 1) + '">' }) +
      U().formRow({ label: '表单宽度', control: '<select id="cfWidth"><option value="1"' + ((f.width || 1) === 1 ? ' selected' : '') + '>1 列</option><option value="2"' + (f.width === 2 ? ' selected' : '') + '>2 列</option><option value="3"' + (f.width === 3 ? ' selected' : '') + '>整行</option></select>' }) +
      '<div class="form-field full"><label>字段选项</label><div class="cf-check-row">' +
        '<label class="ticket-check-line"><input id="cfRequired" type="checkbox"' + (f.required ? ' checked' : '') + '><span>必填</span></label>' +
        '<label class="ticket-check-line"><input id="cfList" type="checkbox"' + (f.list ? ' checked' : '') + '><span>列表显示</span></label>' +
        '<label class="ticket-check-line"><input id="cfFilter" type="checkbox"' + (f.filter ? ' checked' : '') + '><span>支持筛选</span></label>' +
        '<label class="ticket-check-line"><input id="cfExport" type="checkbox"' + (f.export ? ' checked' : '') + '><span>导出</span></label>' +
        '<label class="ticket-check-line"><input id="cfEnabled" type="checkbox"' + (!f.id || f.enabled !== false ? ' checked' : '') + '><span>启用</span></label>' +
      '</div></div>' +
      '<div class="form-field full"><label>可编辑角色</label><div class="cf-check-row">' + roleChecks + '</div><span class="form-hint">不勾选时默认全部角色可编辑；员工对非本人数据始终只读。</span></div>' +
    '</div>' +
    '<div class="cf-live-preview">' +
      '<div class="cf-live-preview-head"><h4>实时预览</h4><span>修改字段配置后即时更新</span></div>' +
      '<div class="cf-preview-grid" id="cfLivePreviewBody" inert></div>' +
    '</div>';
  }

  function previewValue(f) {
    if (f.defaultValue) return f.defaultValue;
    if (f.type === 'switch') return true;
    if (f.type === 'number' || f.type === 'amount') return 12;
    if (f.type === 'date') return D.meta.today;
    if (f.type === 'datetime') return D.meta.today + ' 18:00';
    if (f.type === 'select' || f.type === 'multiselect') return fieldOptions(f)[0] || '';
    if (f.type === 'attachment') return [];
    if (f.type === 'person') return (S().staff[0] || {}).name || '';
    return '示例值';
  }

  function openFieldPreview(draft) {
    const sample = {};
    sample[draft.key] = previewValue(draft);
    if (draft.dependsOn) sample[draft.dependsOn] = draft.dependsValue || '示例值';
    U().modal({
      title: '字段效果预览',
      sub: draft.label + ' · ' + ((FIELD_TYPES.find(function (t) { return t[0] === draft.type; }) || [])[1] || draft.type),
      wide: true,
      body: '<div class="cf-preview-grid">' +
        '<div class="cf-preview-card"><h4>表单效果</h4><div class="form-field"><label>' + U().esc(draft.label) +
          (draft.required ? ' <em>*</em>' : '') + '</label>' + control(draft, { extra: sample }) + '</div></div>' +
        '<div class="cf-preview-card"><h4>详情效果</h4><div class="table-wrap"><table class="data-table"><tbody><tr><td>' + U().esc(draft.label) + '</td><td>' + fmtFieldValue(draft, sample[draft.key]) + '</td></tr></tbody></table></div></div>' +
      '</div>',
      foot: '<button class="btn btn-ghost" data-close type="button">关闭</button>',
      onMount: function (close, root) { root.querySelector('[data-close]').addEventListener('click', close); }
    });
  }

  function openFieldForm(module, f) {
    const editing = !!f;
    U().modal({
      title: editing ? '编辑字段 · ' + f.label : '新增自定义字段',
      sub: '字段编码保存后不可修改 · 自定义字段值保存在记录的 extra 对象',
      xwide: true,
      body: fieldFormBody(module, f),
      foot: '<button class="btn btn-ghost" data-cancel type="button">取消</button>' +
        '<span class="spacer"></span><button class="btn btn-soft" data-preview type="button">预览效果</button>' +
        '<button class="btn btn-primary" data-save type="button">' + (editing ? '保存修改' : '创建字段') + '</button>',
      onMount: function (close, root) {
        U().bindFieldClear(root);
        const sourceEl = root.querySelector('#cfSource');
        const dictEl = root.querySelector('#cfDict');
        const optionsWrap = root.querySelector('#cfOptionsWrap');
        const syncSource = function () {
          const v = sourceEl.value;
          dictEl.closest('.form-field').style.display = v === 'dict' ? '' : 'none';
          optionsWrap.style.display = v === 'options' ? '' : 'none';
        };
        sourceEl.addEventListener('change', syncSource);
        syncSource();
        const readDraft = function () {
          const roles = [];
          root.querySelectorAll('[data-role]').forEach(function (cb) { if (cb.checked) roles.push(cb.dataset.role); });
          return {
            label: root.querySelector('#cfLabel').value.trim() || '字段名称',
            key: root.querySelector('#cfKey').value.trim() || 'fieldKey',
            type: root.querySelector('#cfType').value,
            scope: root.querySelector('#cfScope').value || 'main',
            dependsOn: root.querySelector('#cfDependsOn').value,
            dependsValue: root.querySelector('#cfDependsValue').value.trim(),
            source: sourceEl.value,
            dictId: dictEl.value,
            options: root.querySelector('#cfOptions').value,
            defaultValue: root.querySelector('#cfDefault').value,
            required: root.querySelector('#cfRequired').checked,
            unit: root.querySelector('#cfUnit').value.trim(),
            placeholder: root.querySelector('#cfPlaceholder').value.trim(),
            min: root.querySelector('#cfMin').value,
            max: root.querySelector('#cfMax').value,
            pattern: root.querySelector('#cfPattern').value.trim(),
            group: root.querySelector('#cfGroup').value,
            sort: Number(root.querySelector('#cfSort').value) || 0,
            width: Number(root.querySelector('#cfWidth').value) || 1,
            list: root.querySelector('#cfList').checked,
            filter: root.querySelector('#cfFilter').checked,
            export: root.querySelector('#cfExport').checked,
            editableRoles: roles,
            enabled: root.querySelector('#cfEnabled').checked
          };
        };
        const paintPreview = function () {
          const holder = root.querySelector('#cfLivePreviewBody');
          if (!holder) return;
          const draft = readDraft();
          const sample = {};
          sample[draft.key] = previewValue(draft);
          if (draft.dependsOn) sample[draft.dependsOn] = draft.dependsValue || '示例值';
          holder.innerHTML =
            '<div class="cf-preview-card"><h4>表单效果</h4><div class="form-field"><label>' + U().esc(draft.label) +
              (draft.required ? ' <em>*</em>' : '') + '</label>' + control(draft, { extra: sample }) + '</div></div>' +
            '<div class="cf-preview-card"><h4>详情效果</h4><div class="table-wrap"><table class="data-table"><tbody><tr><td>' +
              U().esc(draft.label) + '</td><td>' + fmtFieldValue(draft, sample[draft.key]) + '</td></tr></tbody></table></div></div>';
        };
        root.addEventListener('input', paintPreview);
        root.addEventListener('change', paintPreview);
        paintPreview();
        root.querySelector('[data-preview]').addEventListener('click', function () {
          openFieldPreview(readDraft());
        });
        root.querySelector('[data-cancel]').addEventListener('click', close);
        root.querySelector('[data-save]').addEventListener('click', function () {
          const labelEl = root.querySelector('#cfLabel');
          const keyEl = root.querySelector('#cfKey');
          const label = labelEl.value.trim();
          let key = keyEl.value.trim();
          for (const pair of [[labelEl, label ? '' : '请输入字段名称'], [keyEl, key ? '' : '请输入字段编码']]) {
            if (pair[1] && !pair[0].value.trim()) { U().showFieldError(pair[0], pair[1]); return; }
          }
          if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) { U().showFieldError(keyEl, '编码需以字母开头，仅含字母、数字、下划线'); return; }
          const targetModule = root.querySelector('#cfModule').value;
          const duplicate = fields().some(function (x) { return x.module === targetModule && x.key === key && (!editing || x !== f); });
          if (duplicate) { U().showFieldError(keyEl, '该模块下编码已存在'); return; }
          const dependsOn = root.querySelector('#cfDependsOn').value;
          if (dependsOn && dependsOn === key) {
            U().showFieldError(keyEl, '字段不能依赖自身');
            return;
          }
          const dependency = dependsOn ? fields().find(function (x) {
            return x.module === targetModule && x.key === dependsOn && (!editing || x !== f);
          }) : null;
          if (dependsOn && !dependency) { U().toast('依赖字段不存在，请重新选择', 'warn'); return; }
          if (dependency && dependency.dependsOn === key) { U().toast('不能与依赖字段互相引用', 'warn'); return; }
          const roles = [];
          root.querySelectorAll('[data-role]').forEach(function (cb) { if (cb.checked) roles.push(cb.dataset.role); });
          if (!roles.length) { U().toast('请至少选择一个可编辑角色', 'warn'); return; }
          const data = {
            module: targetModule,
            label: label,
            key: key,
            type: root.querySelector('#cfType').value,
            scope: root.querySelector('#cfScope').value || 'main',
            dependsOn: dependsOn,
            dependsValue: dependsOn ? root.querySelector('#cfDependsValue').value.trim() : '',
            source: sourceEl.value,
            dictId: dictEl.value,
            options: root.querySelector('#cfOptions').value,
            defaultValue: root.querySelector('#cfDefault').value,
            required: root.querySelector('#cfRequired').checked,
            unit: root.querySelector('#cfUnit').value.trim(),
            placeholder: root.querySelector('#cfPlaceholder').value.trim(),
            min: root.querySelector('#cfMin').value,
            max: root.querySelector('#cfMax').value,
            pattern: root.querySelector('#cfPattern').value.trim(),
            group: root.querySelector('#cfGroup').value,
            sort: Number(root.querySelector('#cfSort').value) || 0,
            width: Number(root.querySelector('#cfWidth').value) || 1,
            list: root.querySelector('#cfList').checked,
            filter: root.querySelector('#cfFilter').checked,
            export: root.querySelector('#cfExport').checked,
            editableRoles: roles,
            enabled: root.querySelector('#cfEnabled').checked,
            updatedAt: D.meta.demoNow
          };
          if (editing) {
            Object.assign(f, data);
          } else {
            data.id = 'CF-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
            data.createdAt = D.meta.demoNow;
            fields().push(data);
          }
          ITO.log(editing ? '编辑自定义字段' : '新增自定义字段', data.label + '（' + data.key + '）', '配置');
          U().toast(editing ? '字段定义已保存' : '字段已创建，表单与详情已同步');
          S().ui.fieldModule = targetModule;
          close();
          ITO.refresh();
        });
      }
    });
  }
})();
