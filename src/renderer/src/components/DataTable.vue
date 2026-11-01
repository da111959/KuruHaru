<script setup>
import { h } from "vue";

const props = defineProps({
  columns: { type: Array, default: () => [] },
  data: { type: Array, default: () => [] },
  rowKey: { type: Function, default: null },
  checkedRowKeys: { type: Array, default: () => [] },
  rowClassName: { type: Function, default: null },
});

const emit = defineEmits(["update:checkedRowKeys"]);

const keyOf = (row, index) => props.rowKey?.(row) ?? row.key ?? index;

const renderCell = (column, row, index) => {
  if (column.type === "selection") {
    const key = keyOf(row, index);
    return h("input", {
      type: "checkbox",
      checked: props.checkedRowKeys.includes(key),
      disabled: column.disabled?.(row) === true,
      "aria-label": `选择 ${key}`,
      onChange: (event) => {
        const next = event.target.checked
          ? [...props.checkedRowKeys, key]
          : props.checkedRowKeys.filter((item) => item !== key);
        emit("update:checkedRowKeys", next);
      },
    });
  }

  if (typeof column.render === "function") {
    const rendered = column.render(row, index);
    return rendered?.__v_isVNode ? rendered : h("span", null, rendered ?? "");
  }
  return h("span", null, row[column.key] ?? "");
};
</script>

<template>
  <div class="data-table-scroll" role="region" tabindex="0" aria-label="数据表格">
    <table class="data-table">
      <thead>
        <tr>
          <th v-for="column in columns" :key="column.key || column.title" scope="col">
            {{ column.type === "selection" ? "选择" : column.title }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, index) in data"
          :key="keyOf(row, index)"
          :class="rowClassName?.(row)"
        >
          <td v-for="column in columns" :key="column.key || column.title">
            <component :is="renderCell(column, row, index)" v-if="column.type !== 'selection'" />
            <input
              v-else
              type="checkbox"
              :checked="props.checkedRowKeys.includes(keyOf(row, index))"
              :disabled="column.disabled?.(row) === true"
              :aria-label="`选择 ${keyOf(row, index)}`"
              @change="(event) => {
                const key = keyOf(row, index);
                const next = event.target.checked
                  ? [...props.checkedRowKeys, key]
                  : props.checkedRowKeys.filter((item) => item !== key);
                emit('update:checkedRowKeys', next);
              }"
            />
          </td>
        </tr>
        <tr v-if="!data.length">
          <td :colspan="Math.max(columns.length, 1)" class="data-table-empty">暂无数据</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
