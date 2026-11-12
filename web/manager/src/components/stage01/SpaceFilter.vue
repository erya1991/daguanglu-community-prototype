<template>
  <aside class="s1-space-tree">
    <h3>房屋范围</h3>
    <Tree :data="nodes" @on-select-change="select" />
  </aside>
</template>
<script>
export default {
  props: {
    spaces: { type: Object, default: () => ({}) },
    value: { type: Object, default: () => ({}) },
  },
  computed: {
    nodes() {
      const s = this.spaces,
        make = (r, level, children = []) => ({
          title: r.name,
          level,
          id: r._id,
          expand: true,
          selected: this.value.id === r._id,
          children,
        });
      const houses = (test) =>
        (s.houses || []).filter(test).map((h) => make(h, "house"));
      return [
        {
          title: "全部授权房屋",
          level: "",
          id: "",
          expand: true,
          selected: !this.value.id,
          children: (s.estates || []).map((e) =>
            make(
              e,
              "estate",
              (s.buildings || [])
                .filter((b) => b.estate === e._id)
                .map((b) =>
                  make(b, "building", [
                    ...(s.units || [])
                      .filter((u) => u.building === b._id)
                      .map((u) =>
                        make(
                          u,
                          "unit",
                          houses((h) => h.unit === u._id)
                        )
                      ),
                    ...houses((h) => h.building === b._id && !h.unit),
                  ])
                )
            )
          ),
        },
      ];
    },
  },
  methods: {
    select(rows) {
      const r = rows[0] || {};
      this.$emit("input", { level: r.level || "", id: r.id || "" });
    },
  },
};
</script>
