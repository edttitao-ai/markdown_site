---
id: string-stringbuilder-stringbuffer
title: String、StringBuilder、StringBuffer 的区别？
category: 基础
tags:
  - Java
  - 基础
  - String
createdAt: 2026-06-26T10:00:00.000Z
updatedAt: '2026-06-26T14:33:12.873Z'
---


# 一句话核心结论

`String` 不可变、`StringBuilder` 线程不安全但快、`StringBuffer` 线程安全但慢。

## 对比表

| 类 | 可变性 | 线程安全 | 性能 | 适用场景 |
| --- | --- | --- | --- | --- |
| `String` | ❌ 不可变 | ✅ | 拼接慢 | 字符串常量、少量拼接 |
| `StringBuilder` | ✅ 可变 | ❌ | **最快** | 单线程下大量拼接 |
| `StringBuffer` | ✅ 可变 | ✅（synchronized）| 中等 | 多线程下大量拼接 |

## 为什么 String 拼接慢？

```java
String s = "a" + "b" + "c" + "d";
```

这行代码**实际**等价于：

```java
String s = new StringBuilder()
    .append("a").append("b").append("c").append("d")
    .toString();
```

每次 `+` 都会创建新的 StringBuilder 和 String 对象，循环里尤其糟糕。

## 反例：循环里用 + 拼接

```java
// ❌ 慢：每次循环都新建 StringBuilder
String result = "";
for (int i = 0; i < 10000; i++) {
    result += i;
}

// ✅ 快：只创建一个 StringBuilder
StringBuilder sb = new StringBuilder();
for (int i = 0; i < 10000; i++) {
    sb.append(i);
}
String result = sb.toString();
```

性能差距在循环 10000 次时大概是 **200 倍**。

## 选谁？

> **99% 的情况用 `StringBuilder`。**
> `StringBuffer` 已经被现代 Java（9+）的字符串拼接内部优化追平甚至反超，几乎不再被推荐。

---

## 拓展：Java 9 的 Compact Strings

Java 9 之后 `String` 内部从 `char[]` 改成 `byte[]` + 编码标记，节省了一半内存。`+` 拼接在单行场景下 JVM 还会做**常量折叠**，比 StringBuilder 还快。

但循环里仍然推荐显式用 StringBuilder——可读性和明确性更好。