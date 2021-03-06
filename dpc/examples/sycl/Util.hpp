#include <iostream>
template<class T>
int check(T *ref, T *a, int len) {
  for (int i = 0; i < len; i++)
    if (abs(ref[i] - a[i]) > 0.01) {
      std::cout << "Failed\n";
      return 1;
    }
  return 0;
}

template<class T>
void dump(T *ref, int len, std::string name) {
  for (int i = 0; i < len; i++)
    std::cout << name + "[" << i << "] = " << ref[i] << std::endl;
  return;
}

