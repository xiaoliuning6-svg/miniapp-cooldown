// components/decision-card —— 决策单卡片
Component({
  properties: {
    item: { type: Object, value: {} },
    showCountdown: { type: Boolean, value: true }
  },
  data: {
    statusMap: {
      cooling: '冷静中', passed: '建议买', rejected: '建议别买',
      purchased: '已购买', abandoned: '已放弃·省下了'
    }
  },
  methods: {
    onTap() {
      this.triggerEvent('tap', { id: this.properties.item.id });
    }
  }
});
