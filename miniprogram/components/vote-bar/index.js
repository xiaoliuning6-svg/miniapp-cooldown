// components/vote-bar —— 审批投票：通过/驳回 + 强制理由
Component({
  properties: {
    disabled: { type: Boolean, value: false },
    submitted: { type: Boolean, value: false }
  },
  data: { reason: '' },
  methods: {
    onInput(e) { this.setData({ reason: e.detail.value }); },
    onApprove() { this._vote('approve'); },
    onReject() { this._vote('reject'); },
    _vote(choice) {
      const reason = this.data.reason.trim();
      if (reason.length < 2) {
        this.triggerEvent('needreason', { choice });
        return;
      }
      this.triggerEvent('vote', { choice, reason });
    }
  }
});
